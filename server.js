const express=require("express");
const session=require("express-session");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");
const helmet=require("helmet");
const rateLimit=require("express-rate-limit");
const path=require("path");
try{require("dotenv").config()}catch(e){}

const app=express();
const db=new Database(process.env.DB_PATH||"aob.db");
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',
 phone TEXT,verified INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,slug TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,seller_id INTEGER NOT NULL,category_id INTEGER,
 name TEXT NOT NULL,slug TEXT UNIQUE,description TEXT,price_afn INTEGER NOT NULL,
 price_usd REAL,stock INTEGER NOT NULL DEFAULT 0,sku TEXT,images_json TEXT DEFAULT '[]',
 status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,total_afn INTEGER NOT NULL,
 total_usd REAL,payment_method TEXT DEFAULT 'cod',payment_status TEXT DEFAULT 'unpaid',
 order_status TEXT DEFAULT 'pending',address TEXT,tracking_code TEXT,courier TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,
 seller_id INTEGER NOT NULL,qty INTEGER NOT NULL,unit_afn INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_id INTEGER NOT NULL,
 rating INTEGER NOT NULL,comment TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS wishlist(user_id INTEGER,product_id INTEGER,PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,message TEXT NOT NULL,
 seen INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS returns(
 id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,user_id INTEGER NOT NULL,
 reason TEXT,status TEXT DEFAULT 'requested',created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT,sender_id INTEGER NOT NULL,receiver_id INTEGER NOT NULL,
 body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT NOT NULL,meta TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
const seed=()=>{
 const addUser=(name,email,pw,role)=>db.prepare("INSERT OR IGNORE INTO users(name,email,password_hash,role,verified) VALUES(?,?,?,?,1)")
 .run(name,email,bcrypt.hashSync(pw,10),role);
 addUser("AOB Admin","admin@aob.af","Admin123!","admin");
 addUser("Demo Seller","seller@aob.af","Seller123!","seller");
 const cats=[["موبایل","mobile"],["کمپیوټر","computer"],["فیشن","fashion"],["کور","home"],["موټر","cars"],["ورزش","sports"],["نور","other"]];
 const ins=db.prepare("INSERT OR IGNORE INTO categories(name,slug) VALUES(?,?)"); cats.forEach(x=>ins.run(...x));
 const seller=db.prepare("SELECT id FROM users WHERE email=?").get("seller@aob.af").id;
 if(!db.prepare("SELECT 1 FROM products LIMIT 1").get()){
   const c={}; for(const x of db.prepare("SELECT * FROM categories").all()) c[x.slug]=x.id;
   const p=db.prepare(`INSERT INTO products(seller_id,category_id,name,slug,description,price_afn,price_usd,stock,sku)
   VALUES(?,?,?,?,?,?,?,?,?)`);
   [
    ["Samsung Galaxy","mobile","سمارټ فون",18500,260,10,"AOB-MOB-001"],
    ["HP Laptop","computer","د کار او زده کړو لپټاپ",32000,450,7,"AOB-PC-001"],
    ["Wireless Headphones","computer","بېسیم هیډفون",2100,30,20,"AOB-AUD-001"],
    ["Premium Watch","fashion","لاسي ساعت",3500,50,15,"AOB-WAT-001"],
    ["Sports Shoes","sports","ورزشي بوټان",2800,40,12,"AOB-SHO-001"],
    ["Smart TV","home","55 inch Smart TV",28000,390,5,"AOB-TV-001"]
   ].forEach(x=>p.run(seller,c[x[1]],x[0],x[0].toLowerCase().replace(/\s+/g,"-"),x[2],x[3],x[4],x[5],x[6]));
 }
}; seed();

app.use(helmet({contentSecurityPolicy:false}));

try{ db.prepare("SELECT phone FROM users LIMIT 1").get(); }
catch(e){ try{ db.exec("ALTER TABLE users ADD COLUMN phone TEXT UNIQUE"); }catch(_){} }


try{db.exec(`CREATE TABLE IF NOT EXISTS otp_challenges(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 identifier TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER DEFAULT 0,
 verified INTEGER DEFAULT 0,
 created_at INTEGER NOT NULL
)`);}catch(e){}
const otpHash=v=>crypto.createHash("sha256").update(String(v)+String(process.env.OTP_PEPPER||"AOB-OTP")).digest("hex");
const makeOtp=()=>String(Math.floor(100000+Math.random()*900000));

app.use(express.json({limit:"1mb"}));

const writeGuard=(req,res,next)=>{
 if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
   const origin=req.get("origin");
   const host=req.get("host");
   if(origin){
     try{ if(new URL(origin).host!==host) return res.status(403).json({error:"ORIGIN_BLOCKED"}); }catch(e){return res.status(403).json({error:"ORIGIN_BLOCKED"});}
   }
 }
 next();
};
app.use(writeGuard);

app.use(rateLimit({windowMs:15*60*1000,max:300}));
app.use(session({
 secret:process.env.SESSION_SECRET||"CHANGE_THIS_IN_PRODUCTION",
 resave:false,saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:7*86400000}
}));
app.use(express.static(path.join(__dirname,"public")));

const auth=(req,res,next)=>req.session.user?next():res.status(401).json({error:"LOGIN_REQUIRED"});
const role=r=>(req,res,next)=>req.session.user?.role===r?next():res.status(403).json({error:"FORBIDDEN"});
const audit=(uid,action,meta={})=>db.prepare("INSERT INTO audit_logs(user_id,action,meta) VALUES(?,?,?)").run(uid,action,JSON.stringify(meta));
const notify=(uid,msg)=>db.prepare("INSERT INTO notifications(user_id,message) VALUES(?,?)").run(uid,msg);

app.get("/api/health",(req,res)=>res.json({ok:true,service:"AOB",version:"5.0.0"}));
app.get("/api/config",(req,res)=>res.json({brand:"Afghan Online Bazaar",currencies:["AFN","USD"],languages:["ps","fa","en","zh","ur","fr"],internationalShippingReady:true}));

app.post("/api/auth/register",(req,res)=>{
 const {name,email,password,role="customer"}=req.body;
 if(!name||!email||!password||password.length<8)return res.status(400).json({error:"Use a name, email and password of at least 8 characters."});
 const r=role==="seller"?"seller":"customer";
 try{
  const x=db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)").run(name,email,bcrypt.hashSync(password,12),r);
  req.session.user={id:Number(x.lastInsertRowid),name,email,role:r};
  audit(req.session.user.id,"register",{role:r}); res.json({user:req.session.user});
 }catch(e){res.status(409).json({error:"EMAIL_EXISTS"})}
});
app.post("/api/auth/login",(req,res)=>{
 const u=db.prepare("SELECT * FROM users WHERE email=?").get(req.body.email||"");
 if(!u||!bcrypt.compareSync(req.body.password||"",u.password_hash))return res.status(401).json({error:"INVALID_LOGIN"});
 req.session.user={id:u.id,name:u.name,email:u.email,role:u.role}; audit(u.id,"login"); res.json({user:req.session.user});
});
app.post("/api/auth/verify-otp",(req,res)=>{
 const identifier=String(req.body.identifier||"").trim().toLowerCase();
 const code=String(req.body.otp||"").trim();
 const row=db.prepare("SELECT * FROM otp_challenges WHERE identifier=? AND verified=0 ORDER BY id DESC LIMIT 1").get(identifier);
 if(!row)return res.status(400).json({error:"OTP_NOT_FOUND"});
 if(Date.now()>row.expires_at)return res.status(400).json({error:"OTP_EXPIRED"});
 if(row.attempts>=5)return res.status(429).json({error:"OTP_LOCKED"});
 if(otpHash(code)!==row.code_hash){
   db.prepare("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?").run(row.id);
   return res.status(401).json({error:"INVALID_OTP"});
 }
 const u=db.prepare("SELECT id,name,email,phone,role,verified FROM users WHERE lower(email)=? OR phone=? LIMIT 1").get(identifier,identifier);
 if(!u)return res.status(404).json({error:"ACCOUNT_NOT_FOUND"});
 db.prepare("UPDATE otp_challenges SET verified=1 WHERE id=?").run(row.id);
 db.prepare("UPDATE users SET verified=1 WHERE id=?").run(u.id);
 req.session.user={id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,verified:1};
 res.json({ok:true,user:req.session.user});
});
app.post("/api/auth/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));

app.get("/api/categories",(req,res)=>res.json(db.prepare("SELECT * FROM categories ORDER BY name").all()));
app.get("/api/products",(req,res)=>{
 let {q="",category="",min="",max="",sort="new"}=req.query;
 let sql=`SELECT p.*,c.name category,u.name seller FROM products p
 JOIN categories c ON c.id=p.category_id JOIN users u ON u.id=p.seller_id WHERE p.status='active'`;
 let a=[];
 if(q){sql+=" AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)";a.push(`%${q}%`,`%${q}%`,`%${q}%`)}
 if(category){sql+=" AND c.slug=?";a.push(category)}
 if(min){sql+=" AND p.price_afn>=?";a.push(Number(min))}
 if(max){sql+=" AND p.price_afn<=?";a.push(Number(max))}
 sql+=" ORDER BY "+(sort==="price_asc"?"p.price_afn ASC":sort==="price_desc"?"p.price_afn DESC":"p.id DESC");
 res.json(db.prepare(sql).all(...a));
});
app.get("/api/products/:id",(req,res)=>{
 const p=db.prepare(`SELECT p.*,c.name category,u.name seller FROM products p JOIN categories c ON c.id=p.category_id JOIN users u ON u.id=p.seller_id WHERE p.id=? AND p.status='active'`).get(req.params.id);
 if(!p)return res.status(404).json({error:"NOT_FOUND"});
 p.reviews=db.prepare(`SELECT r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? ORDER BY r.id DESC`).all(p.id);
 res.json(p);
});
app.post("/api/seller/products",role("seller"),(req,res)=>{
 const {name,category_id,description,price_afn,price_usd,stock,sku}=req.body;
 if(!name||!category_id||Number(price_afn)<=0)return res.status(400).json({error:"INVALID_PRODUCT"});
 const x=db.prepare(`INSERT INTO products(seller_id,category_id,name,slug,description,price_afn,price_usd,stock,sku)
 VALUES(?,?,?,?,?,?,?,?,?)`).run(req.session.user.id,category_id,name.toLowerCase().replace(/\s+/g,"-")+"-"+Date.now(),description||"",Number(price_afn),Number(price_usd)||null,Number(stock)||0,sku||null);
 audit(req.session.user.id,"product_create",{id:x.lastInsertRowid});res.json({id:x.lastInsertRowid});
});

app.post("/api/wishlist",auth,(req,res)=>{
 try{db.prepare("INSERT INTO wishlist VALUES(?,?)").run(req.session.user.id,req.body.product_id)}
 catch(e){db.prepare("DELETE FROM wishlist WHERE user_id=? AND product_id=?").run(req.session.user.id,req.body.product_id)}
 res.json({ok:true});
});
app.get("/api/wishlist",auth,(req,res)=>res.json(db.prepare(`SELECT p.* FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=?`).all(req.session.user.id)));

app.post("/api/reviews",auth,(req,res)=>{
 const rating=Math.max(1,Math.min(5,Number(req.body.rating)));
 db.prepare("INSERT INTO reviews(user_id,product_id,rating,comment) VALUES(?,?,?,?)").run(req.session.user.id,req.body.product_id,rating,req.body.comment||"");
 res.json({ok:true});
});

app.post("/api/orders",auth,(req,res)=>{
 const items=Array.isArray(req.body.items)?req.body.items:[],address=req.body.address||"",payment=req.body.payment_method||"cod";
 if(!items.length)return res.status(400).json({error:"EMPTY_CART"});
 const get=db.prepare("SELECT * FROM products WHERE id=? AND status='active'");
 const rows=[];let total=0;
 for(const i of items){
   const p=get.get(i.product_id),qty=Math.max(1,Number(i.qty)||1);
   if(!p||p.stock<qty)return res.status(400).json({error:"OUT_OF_STOCK",product_id:i.product_id});
   total+=p.price_afn*qty;rows.push({p,qty});
 }
 const tx=db.transaction(()=>{
   const o=db.prepare("INSERT INTO orders(user_id,total_afn,total_usd,payment_method,address) VALUES(?,?,?,?,?)")
    .run(req.session.user.id,total,null,payment,address);
   const oi=db.prepare("INSERT INTO order_items(order_id,product_id,seller_id,qty,unit_afn) VALUES(?,?,?,?,?)");
   const up=db.prepare("UPDATE products SET stock=stock-? WHERE id=?");
   for(const x of rows){oi.run(o.lastInsertRowid,x.p.id,x.p.seller_id,x.qty,x.p.price_afn);up.run(x.qty,x.p.id);notify(x.p.seller_id,`نوی فرمایش #${o.lastInsertRowid} ترلاسه شو.`)}
   notify(req.session.user.id,`ستاسو فرمایش #${o.lastInsertRowid} ثبت شو.`);
   audit(req.session.user.id,"order_create",{order_id:o.lastInsertRowid,total});
   return Number(o.lastInsertRowid);
 });
 res.json({ok:true,order_id:tx(),payment_status:payment==="cod"?"unpaid":"gateway_required"});
});
app.get("/api/orders",auth,(req,res)=>res.json(db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC").all(req.session.user.id)));
app.post("/api/orders/:id/return",auth,(req,res)=>{
 const o=db.prepare("SELECT * FROM orders WHERE id=? AND user_id=?").get(req.params.id,req.session.user.id);
 if(!o)return res.status(404).json({error:"NOT_FOUND"});
 const x=db.prepare("INSERT INTO returns(order_id,user_id,reason) VALUES(?,?,?)").run(o.id,o.user_id,req.body.reason||"");
 notify(req.session.user.id,`ستاسو د فرمایش #${o.id} د بېرته ستنولو غوښتنه ثبت شوه.`);
 res.json({id:x.lastInsertRowid,status:"requested"});
});
app.get("/api/notifications",auth,(req,res)=>res.json(db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100").all(req.session.user.id)));

app.post("/api/messages",auth,(req,res)=>{
 if(!req.body.receiver_id||!req.body.body)return res.status(400).json({error:"INVALID_MESSAGE"});
 db.prepare("INSERT INTO messages(sender_id,receiver_id,body) VALUES(?,?,?)").run(req.session.user.id,req.body.receiver_id,req.body.body);
 notify(req.body.receiver_id,"تاسو ته نوی پیغام راغلی.");
 res.json({ok:true});
});

app.get("/api/admin/stats",role("admin"),(req,res)=>res.json({
 users:db.prepare("SELECT COUNT(*) c FROM users").get().c,
 sellers:db.prepare("SELECT COUNT(*) c FROM users WHERE role='seller'").get().c,
 products:db.prepare("SELECT COUNT(*) c FROM products").get().c,
 orders:db.prepare("SELECT COUNT(*) c FROM orders").get().c,
 returns:db.prepare("SELECT COUNT(*) c FROM returns").get().c,
 revenue_afn:db.prepare("SELECT COALESCE(SUM(total_afn),0) s FROM orders WHERE payment_status='paid'").get().s
}));
app.get("/api/admin/orders",role("admin"),(req,res)=>res.json(db.prepare(`SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 200`).all()));
app.post("/api/admin/orders/:id/status",role("admin"),(req,res)=>{
 const o=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);if(!o)return res.status(404).json({error:"NOT_FOUND"});
 db.prepare("UPDATE orders SET order_status=?,tracking_code=?,courier=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
 .run(req.body.status||"pending",req.body.tracking_code||"",req.body.courier||"",o.id);
 notify(o.user_id,`ستاسو فرمایش #${o.id} نوی حالت: ${req.body.status||"pending"}`);
 audit(req.session.user.id,"order_status",{order_id:o.id,status:req.body.status});res.json({ok:true});
});


app.post("/api/ai/assist", async (req,res)=>{
 const msg=String(req.body.message||"").trim();
 const lang=req.body.language||"ps";
 if(!msg)return res.json({reply:"پوښتنه ولیکئ."});
 const lower=msg.toLowerCase();
 let products=[];
 const money=msg.match(/(\d[\d,]*)\s*(?:افغانی|افغانۍ|afn|afs)/i);
 if(/موبایل|موبايل|phone|mobile|سمارټ|smart/i.test(msg)) {
   products=db.prepare(`SELECT id,name,price_afn,stock FROM products WHERE status='active' AND category_id=(SELECT id FROM categories WHERE slug='mobile') ORDER BY price_afn ASC LIMIT 5`).all();
 } else if(/لپټاپ|لپتاپ|کمپیوټر|computer|laptop/i.test(msg)) {
   products=db.prepare(`SELECT id,name,price_afn,stock FROM products WHERE status='active' AND category_id=(SELECT id FROM categories WHERE slug='computer') ORDER BY price_afn ASC LIMIT 5`).all();
 } else if(money) {
   const budget=Number(money[1].replace(/,/g,""));
   products=db.prepare(`SELECT id,name,price_afn,stock FROM products WHERE status='active' AND price_afn<=? ORDER BY price_afn DESC LIMIT 5`).all(budget);
 }
 if(products.length){
   let reply=lang==="en"?"I found these products that may fit your request.":lang==="fa"?"این محصولات ممکن است برای شما مناسب باشند:":"دا محصولات ستاسې د غوښتنې لپاره مناسب ښکاري:";
   return res.json({reply,products});
 }
 if(/delivery|ډیلوري|سپارل|رسول|ولایت|کابل/i.test(msg))
   return res.json({reply:"AOB د افغانستان لپاره Delivery معماري لري. د فرمایش پر مهال خپله پته ولیکئ؛ د Delivery فیس او حالت به د سیمې له مخې محاسبه/اداره کېږي. نړیوال Shipping هم د راتلونکي لپاره تیار شوی."});
 if(/فرمایش|سفارش|order|تعقیب|tracking|track/i.test(msg)){
   if(req.session.user){
     const o=db.prepare("SELECT id,order_status,tracking_code FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 5").all(req.session.user.id);
     return res.json({reply:o.length?("ستاسې وروستي فرمایشونه:\n"+o.map(x=>`#${x.id} — ${x.order_status}${x.tracking_code?" — "+x.tracking_code:""}`).join("\n")):"تر اوسه ستاسې په حساب کې فرمایش نشته."});
   }
   return res.json({reply:"د فرمایش د تعقیب لپاره لومړی خپل AOB حساب ته Login وکړئ."});
 }
 if(/سلام|hello|hi|assalamu|السلام/i.test(msg))
   return res.json({reply:"وعلیکم سلام! 👋 زه د AOB AI مرستیال یم. کولی شم محصول پیدا کړم، د بودجې مطابق انتخاب درکړم، د فرمایش په اړه مرسته وکړم او د Delivery معلومات درکړم."});
 if(/څنګه|how|help|مرسته/i.test(msg))
   return res.json({reply:"زه درسره د محصول موندلو، د بیې مقایسه، فرمایش، Delivery، Seller او AOB حساب په اړه مرسته کولی شم. مثال: «زما بودجه ۲۰۰۰۰ افغانۍ ده، ښه موبایل پیدا کړه.»"});
 res.json({reply:"زه ستاسې پوښتنه درک کوم. د دقیقې مرستې لپاره د محصول نوم، بودجه یا د فرمایش/Delivery موضوع ولیکئ. د حقیقي AI API د نښلولو لپاره د AOB_AI_API_KEY به وروسته په server environment کې فعالېږي."});
});


const cleanText=(v,max=2000)=>String(v??"").trim().slice(0,max);
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||""));
app.get("/api/policies",(req,res)=>res.json({
 terms:"AOB Terms & Conditions — Demo policy. Production legal review required.",
 privacy:"AOB Privacy Policy — customer data is used to provide marketplace services and support.",
 returns:"Returns are subject to seller/product conditions and AOB dispute policy.",
 delivery:"Delivery availability, fees and estimated time depend on location and courier.",
 seller:"Sellers must provide accurate product information and comply with AOB marketplace rules."
}));
app.get("/api/search/suggestions",(req,res)=>{
 const q=cleanText(req.query.q,100);
 if(!q)return res.json([]);
 res.json(db.prepare("SELECT id,name,price_afn FROM products WHERE status='active' AND name LIKE ? ORDER BY id DESC LIMIT 8").all(`%${q}%`));
});
app.get("/api/seller/products",role("seller"),(req,res)=>res.json(db.prepare("SELECT * FROM products WHERE seller_id=? ORDER BY id DESC").all(req.session.user.id)));
app.put("/api/seller/products/:id",role("seller"),(req,res)=>{
 const p=db.prepare("SELECT * FROM products WHERE id=? AND seller_id=?").get(req.params.id,req.session.user.id);
 if(!p)return res.status(404).json({error:"NOT_FOUND"});
 const name=cleanText(req.body.name,200)||p.name, desc=cleanText(req.body.description,5000);
 const price=Number(req.body.price_afn); const stock=Number(req.body.stock);
 if(!Number.isFinite(price)||price<=0||!Number.isInteger(stock)||stock<0)return res.status(400).json({error:"INVALID_PRODUCT"});
 db.prepare("UPDATE products SET name=?,description=?,price_afn=?,price_usd=?,stock=?,sku=? WHERE id=?")
 .run(name,desc,price,Number(req.body.price_usd)||null,stock,cleanText(req.body.sku,80)||null,p.id);
 audit(req.session.user.id,"product_update",{id:p.id});res.json({ok:true});
});
app.delete("/api/seller/products/:id",role("seller"),(req,res)=>{
 const p=db.prepare("SELECT id FROM products WHERE id=? AND seller_id=?").get(req.params.id,req.session.user.id);
 if(!p)return res.status(404).json({error:"NOT_FOUND"});
 db.prepare("UPDATE products SET status='inactive' WHERE id=?").run(p.id); audit(req.session.user.id,"product_archive",{id:p.id});res.json({ok:true});
});
app.get("/api/seller/orders",role("seller"),(req,res)=>res.json(db.prepare(`
 SELECT o.*,u.name customer,u.email FROM orders o JOIN order_items oi ON oi.order_id=o.id
 JOIN users u ON u.id=o.user_id WHERE oi.seller_id=? GROUP BY o.id ORDER BY o.id DESC`).all(req.session.user.id)));
app.get("/api/admin/users",role("admin"),(req,res)=>res.json(db.prepare("SELECT id,name,email,role,verified,created_at FROM users ORDER BY id DESC LIMIT 500").all()));
app.post("/api/admin/sellers/:id/verify",role("admin"),(req,res)=>{
 const u=db.prepare("SELECT id FROM users WHERE id=? AND role='seller'").get(req.params.id);
 if(!u)return res.status(404).json({error:"NOT_FOUND"});
 db.prepare("UPDATE users SET verified=1 WHERE id=?").run(u.id); audit(req.session.user.id,"seller_verify",{seller_id:u.id});res.json({ok:true});
});
app.get("/api/admin/returns",role("admin"),(req,res)=>res.json(db.prepare(`
 SELECT r.*,u.name,u.email FROM returns r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 500`).all()));
app.post("/api/admin/returns/:id/status",role("admin"),(req,res)=>{
 const r=db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id);
 if(!r)return res.status(404).json({error:"NOT_FOUND"});
 const status=["requested","approved","rejected","received","refunded","closed"].includes(req.body.status)?req.body.status:"requested";
 db.prepare("UPDATE returns SET status=? WHERE id=?").run(status,r.id);notify(r.user_id,`د Return غوښتنې #${r.id} حالت: ${status}`);audit(req.session.user.id,"return_status",{return_id:r.id,status});res.json({ok:true});
});
app.get("/api/admin/audit",role("admin"),(req,res)=>res.json(db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500").all()));

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("AOB Global v5 running"));
