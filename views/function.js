function check() {
    var quantity = document.forms["form1"]["product[quantity]"];
    var max = document.forms["form1"]["product[stock]"];
    console.log(quantity);
    console.log(max);

    if (quantity.value > max.value) {
        window.alert("Not in stock");
        quantity.focus();
        return false;
    }

    return true;
}
