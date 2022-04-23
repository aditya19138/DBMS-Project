const express = require('express');
const app = express();
var mysql = require('mysql');
const path = require('path');
require('dotenv').config();
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: process.env.password,
    port: 3308,
    database: "dbmsproject",
    multipleStatements: true
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Hurray!! Database Connected!");
});


app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname + "/views")));
app.use(express.urlencoded({ extended: true }))

const sessionConfig = {
    secret: 'helloworld',
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 2,     //date is in ms and session will expire after 2 days
        maxAge: 1000 * 60 * 60 * 24 * 2
    }
}
app.use(session(sessionConfig))
app.use(flash())
app.use((req, res, next) => {
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next();
})

const isAdminLoggedIn = (req, res, next) => {
    if (!req.session.adminId) {
        req.flash('error', 'Please login first. Sorry (:')
        return res.redirect('/admin/login');
    }
    next();
}
const isLoggedIn = (req, res, next) => {
    if (!req.session.emailId) {
        req.flash('error', 'Please login first. Sorry (:')
        return res.redirect('/');
    }
    next();
}

app.get("/", (req, res) => {
    res.render("index")

})

app.get("/products", isLoggedIn, async (req, res) => {
    await con.query(`select * from product`, (err, result, fields) => {
        if (err) {
            console.log(err);
            return;
        }
        var rows = JSON.parse(JSON.stringify(result));
        // console.log(rows)
        res.render("products", { rows });
    });
})

app.get('/admin', isAdminLoggedIn, async (req, res) => {
    await con.query(`select * from product where adminId='${req.session.adminId}'`, (err, result, fields) => {
        if (err) {
            console.log(err)
            return;
        }
        var rows = JSON.parse(JSON.stringify(result));
        // console.log(rows);
        res.render('admin', { rows })
    })
})

app.get("/admin/login", (req, res) => {
    res.render("login")
})

app.get('/admin/logout', (req, res) => {
    req.session.adminId = null;
    req.flash('success', 'Logged out successfully! Love to see you again :)')
    res.redirect('/admin/login')
})


app.get("/product/add", isAdminLoggedIn, async (req, res) => {
    await con.query(`select * from category;select * from supplier`, (err, result, fields) => {
        if (err) {
            console.log(err)
            return;
        }
        var categories = JSON.parse(JSON.stringify(result[0]));
        var suppliers = JSON.parse(JSON.stringify(result[1]));
        res.render("productAdd", { categories, suppliers })
    })
})

app.get('/logout', (req, res) => {
    req.session.emailId = null;
    res.redirect('/');
})

app.post('/register', async (req, res) => {
    const { email, password, phoneNumber, postalcode, city, name } = req.body;
    await con.query(`select exists(select * from person where email='${email}')`
        , (err, result, fields) => {
            if (err) {
                console.log(err);
                return res.redirect('/');
            }
            var exists = JSON.parse(JSON.stringify(result))[0][`exists(select * from person where email='${email}')`];
            console.log(exists);
            if (exists) {
                req.flash('error', 'Email already exists');
                return res.redirect('/')
            }
            else {
                con.query(`insert into person(name,email,phoneNumber,postalcode,city) 
                            values ('${name}','${email}','${phoneNumber}','${postalcode}','${city}');
                            insert into customer(personId,password) 
                            values ((select personId from person where email="${email}"),"${password}")`,
                    (err1, res1, fields1) => {
                        if (err1) {
                            console.log(err1);
                            return;
                        }
                        req.session.emailId = email;
                        req.flash('success', 'Logged In successfully !!')
                        res.redirect('/products')
                    });

            }

        })
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    await con.query(`select exists(select * 
                            from customer C
                            natural join person P
                            where email='${email}' and password='${password}')`, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.redirect('/');
        }
        var rows = JSON.parse(JSON.stringify(result));
        out = rows[0][`exists(select * 
                            from customer C
                            natural join person P
                            where email='${email}' and password='${password}')`];
        console.log(out)
        if (out >= 1) {
            req.flash('success', 'You have logged in successfully!!');
            req.session.emailId = email;
            console.log(req.session.emailId)
            return res.redirect('/products')
        }
        else {

            req.flash('error', 'Incorrect Email or password. Please login again !!')
            // console.log(res.locals)
            return res.redirect('/');
        }
    })

})



app.post("/admin/login", async (req, res) => {
    const { email, password } = req.body
    const query = `select exists(select * from admin where adminId='${email}' and password='${password}')`
    await con.query(query, (err, result, fields) => {
        if (err) {
            console.log(err)
            return;
        }
        var rows = JSON.parse(JSON.stringify(result));
        out = rows[0][`exists(select * from admin where adminId='${email}' and password='${password}')`];
        console.log(out)
        if (out >= 1) {
            req.flash('success', 'You have logged in successfully!!');
            req.session.adminId = email;
            console.log(req.session.adminId)
            return res.redirect('/admin')
        }
        else {

            req.flash('error', 'Incorrect Email or password. Please retry')
            console.log(res.locals)
            return res.redirect('/admin/login');
        }
    })
})
app.post("/product/add", isAdminLoggedIn, async (req, res) => {
    const { productId, categoryName, supplierId, warehouseId, unit_price, name, description, weight, unit_in_stock } = req.body;
    const adminId = req.session.adminId;
    await con.query(`insert into product values (${productId},'${categoryName}','${adminId}',${supplierId},${warehouseId},${unit_price},'${name}','${description}',${weight},${unit_in_stock})`, (err, result, fields) => {
        if (err) {
            console.log(err)
            return;
        }
        console.log(result)
        res.redirect('/admin')
    })
})


app.listen(3000, () => {
    console.log("Listening on port 3000")
})
