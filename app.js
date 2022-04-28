const express = require('express');
const app = express();
var mysql = require('mysql');
const { urlencoded } = require('express');
const path = require('path');
const uuid = require("uuid")
const session = require('express-session');
const flash = require('connect-flash');


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/views'));
app.use(express.urlencoded({ extended: true }));

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Adit@2001",
    port: 3308,
    database: "dbmsproject",
    multipleStatements: true
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

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

app.use((req, res, next) => {
    if (req.session.login) {
        res.locals.login = req.session.login;
        res.locals.emailId = req.session.emailId;
        res.locals.customerId = req.session.customerId;
        res.locals.name = req.session.name;
    }
    next();
})

app.get('/', (req, res) => {
    res.locals.login = req.session.login;
    res.render('index');
})

// app.get('/products', isLoggedIn, async (req, res) => {
//     await con.query("select * from product", function (err, result) {
//         if (err) throw err;
//         var products = JSON.parse(JSON.stringify(result));
//         res.render('products', { products })

//     });
// })

app.get("/products", isLoggedIn, async (req, res) => {
    await con.query(`select * from product; select * from product_review; select * from trending_product_view limit 10 `, (err, result, fields) => {
        if (err) {
            console.log(err);
            return;
        }
        var products = JSON.parse(JSON.stringify(result[0]));
        var p_reviews = JSON.parse(JSON.stringify(result[1]));
        console.log(p_reviews[0]);
        var trendingProducts = JSON.parse(JSON.stringify(result[2]));

        res.render("products1", { products, p_reviews, trendingProducts });
    });
})

app.get('/admin', isAdminLoggedIn, async (req, res) => {
    str = `select * from product where adminId='${req.session.adminId}'`;
    await con.query(str, (err, result, fields) => {
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


app.get("/product/add", isAdminLoggedIn, (req, res) => {
    con.query(`select * from category;select * from supplier`, (err, result, fields) => {
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
    req.session.destroy();
    res.redirect('/');
})

app.post('/register', (req, res) => {
    const person = req.body.person;
    console.log(req.body);
    con.query(`select exists(select * from person where email='${person.email}')`, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.redirect('/');
        }

        var exists = JSON.parse(JSON.stringify(result))[0][`exists(select * from person where email='${person.email}')`];
        if (exists) {
            req.flash('error', 'Email already exists');
            return res.redirect('/')
        }

        con.query('select count(*) as cnt from person', (err3, res3) => {
            if (err3) throw err3;

            var personId = JSON.parse(JSON.stringify(res3))[0].cnt + 1;
            console.log("personId :" + personId);
            str1 = `insert into person (personId,name,email,phoneNumber,postalcode,city) values ('${personId}','${person.name}','${person.email}','${person.number}','${person.postalcode}','${person.city}')`
            str2 = `insert into customer(personId,password,category) values ((select personId from person where email="${person.email}"),"${person.password}","prime")`

            con.query(str1, (err1, res1, fields1) => {
                if (err1) {
                    console.log('err1');
                    throw err1;
                }
                console.log('person added');

                con.query(str2, (err2, res2) => {
                    if (err2) {
                        console.log('err2');
                        throw err2;
                    }
                    console.log('customer added');
                })

                con.query('select count(*) as cnt from cart', (err4, res4) => {
                    if (err4) {
                        console.log(err4);
                        throw err4;
                    }

                    cartId = JSON.parse(JSON.stringify(res4))[0].cnt + 1;
                    con.query(`insert into Cart (cartId, customerId) values (${cartId}, ${personId});`, (err5, res5) => {
                        if (err5) throw err5;
                        console.log(`new cart added for the person with personId ${personId} with cartId ${cartId}`);
                    })

                })

                req.session.emailId = person.email;
                req.session.customerId = personId;
                req.flash('success', 'Logged In successfully !!')
                res.redirect('/products')
            });
        })
    })
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    str1 = `select * 
        from customer C
        natural join person P
        where email='${email}' and password='${password}'`;

    con.query(str1, (err, result) => {
        if (err) {
            console.log(err);
            return res.redirect('/');
        }
        var person = JSON.parse(JSON.stringify(result));
        var personData = JSON.parse(JSON.stringify(result))[0];
        console.log(personData);

        if (person.length >= 1 && personData.personId >= 1) {
            req.flash('success', 'You have logged in successfully!!');
            // document.querySelector(".login-postal").remove();
            req.session.login = true;
            req.session.emailId = personData.email;
            req.session.customerId = personData.personId;
            req.session.name = personData.name;
            return res.redirect('/')
        }
        else {
            req.flash('error', 'Incorrect Email or password. Please login again !!')
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
    const { categoryName, supplierId, warehouseId, unit_price, name, description, weight, unit_in_stock } = req.body;
    const adminId = req.session.adminId;

    await con.query('select count(*) as cnt from product', async (err1, result) => {
        if (err1) throw err1;
        productId = JSON.parse(JSON.stringify(result))[0].cnt + 1;

        await con.query(`insert into product values (${productId},'${categoryName}','${adminId}',${supplierId},${warehouseId},${unit_price},'${name}','${description}',${weight},${unit_in_stock})`, (err, result, fields) => {
            if (err) throw err;
            console.log('1 product inserted')
            res.redirect('/admin')
        })
    })
})

app.post("/product/remove", isAdminLoggedIn, async (req, res) => {
    const { productId } = req.body;

    await con.query(`delete from product where productId = ${productId}`, (err, result) => {
        if (err) throw err;

        console.log('1 product deleted');
    })
    res.redirect('/admin');
})

app.post('/review/submit', (req, res) => {
    console.log(req.body);
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    str = `insert into reviews values (${req.session.customerId},${req.body.productId},${req.body.rating},${dd},${mm},${yyyy})`;
    con.query(str, (err, result) => {
        if (err) throw err;
        console.log("1 review added");
    })
    res.redirect('/products');
})


app.post('/buynow', isLoggedIn, async (req, res) => {
    console.log('In buynow');
    customerId = req.session.customerId;
    shipperId = Math.floor(Math.random() * 29);
    transactionId = uuid.v4();
    mode = req.body.mode;
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();

    await con.query('select * from person where personId =' + customerId, async function (err, result) {
        if (err) throw err;
        prsn = JSON.parse(JSON.stringify(result))[0];

        var str = "insert into BillingInfo  values ('" +
            transactionId + "','" + mode + "','" +
            prsn.postalcode + "', '" + prsn.streetname + "', '" + prsn.city + "'," + dd +
            "," + mm + "," + yyyy + ");";

        await con.query(str, function (err, result) {
            if (err) throw err;
            console.log(' 1 entry in billing info');
        });

    });


    con.query("select count(*) as cnt from orders", async function (err, result) {
        if (err) throw err;


        orderId = JSON.parse(JSON.stringify(result))[0].cnt + 1;
        await con.query("select cartId from cart where customerId = " + customerId, async function (err, result) {
            if (err) throw err;
            cartId = JSON.parse(JSON.stringify(result))[0].cartId;
            var qur = "insert into Orders values ("
                + orderId + "," + customerId + "," + shipperId + "," + cartId + ",'" +
                transactionId + "'," + dd + "," + mm + "," + yyyy + ");";

            await con.query(qur, async function (err, result) {
                if (err) throw err;
                console.log(" 1 entry for order done");
            });

            await con.query("select * from cartdetails where cartId = " + cartId, async function (err, result) {
                if (err) throw err;
                var products = JSON.parse(JSON.stringify(result));
                for (let i = 0; i < products.length; i++) {
                    var str1 = "insert into itemDetails values ('" + products[i].productName + "'," + orderId + "," +
                        products[i].quantity + "," + products[i].discount + "," + products[i].price + ");";

                    await con.query(str1, (req, res) => {
                        if (err) throw err;
                        console.log(i + " entry for item detail done");
                    })
                }
                str2 = "select * from billingInfo where txnId = '" + transactionId + "'";

                str = `DELETE FROM cartDetails where cartId = ${cartId}`;
                await con.query(str, function (err, result) {
                    if (err) throw err;
                    console.log('1 row deleted');
                });

                await con.query(str2, (err, result) => {
                    if (err) throw err;
                    var billingInfo = JSON.parse(JSON.stringify(result))[0];
                    console.log(billingInfo);
                    res.render('order', { products, billingInfo });
                })

            });
        });
    });
})

app.get('/cart', isLoggedIn, (req, res) => {
    console.log('In the cart');
    let customerId = req.session.customerId;
    con.query("select cartId from cart where customerId = " + customerId, function (err, result) {
        if (err) throw err;
        console.log(JSON.parse(JSON.stringify(result))[0]);
        cartId = JSON.parse(JSON.stringify(result))[0].cartId;
        con.query("select * from cartdetails where cartId = " + cartId, function (err1, result1) {
            if (err) {
                throw err1;
            } else {
                var products = JSON.parse(JSON.stringify(result1));
                res.render('cart', { products })
            }
        });
    });

})

app.post('/deleteItem', isLoggedIn, async (req, res) => {
    console.log("in delete : " + req.body);
    let customerId = req.session.customerId;
    await con.query("select cartId from cart where customerId = " + customerId, async function (err, result) {
        if (err) {
            throw err;
        } else {
            var cartId = JSON.parse(JSON.stringify(result))[0].cartId;
            // console.log(req.body.Name);

            var str = "delete from cartDetails where cartId = " + cartId + " and productName = '" + req.body.name + "';";
            console.log(str);
            await con.query(str, function (err, result) {
                if (err) {
                    throw err;
                }
                console.log('1 entry deleted');
            });

        }
    });
    res.redirect('cart');
})

app.post('/addtocart', isLoggedIn, async (req, res) => {
    let product = req.body.product;
    console.log(req.session.customerId);
    let customerId = req.session.customerId;
    console.log("customerId=" + customerId)

    await con.query("select cartId from cart where customerId = " + customerId, async function (err, result) {
        if (err) {
            throw err;
        } else {
            var cartId = JSON.parse(JSON.stringify(result))[0].cartId;

            await con.query(`INSERT INTO cartDetails (productName, cartId, quantity, discount, price)
                                values ('${product.productName}',${cartId},${product.quantity},0,${product.price})`, function (err, result) {
                if (err) {
                    throw err;
                }
                console.log('1 row added');
            });
        }
    });
    res.redirect('products');
})


app.listen('3000', (req, res) => {
    console.log('listening');
})