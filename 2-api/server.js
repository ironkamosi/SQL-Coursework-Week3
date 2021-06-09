require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const app = express();

const cors = require("cors");
app.use(express.json());
app.use(cors({ origin: "*" }));

const pool = new Pool();

//-----------------SQL queries-----------------------------
let selectProductsQuery = `
  SELECT
    * FROM products AS p
    INNER JOIN product_availability AS p_a ON p_a.prod_id=p.id
    INNER JOIN suppliers As s ON  s.id=p_a.supp_id `;

const customersSelectQuery = `SELECT * FROM customers Order by id`;
const customerSelectIdOrdersQuery = `SELECT 
        customers.name AS "Customer Name", 
        orders.order_reference, 
        orders.order_date, 
        products.product_name, 
        suppliers.supplier_name, 
        product_availability.unit_price, 
        order_items.quantity
      FROM product_availability
        INNER JOIN products ON products.id=product_availability.prod_id
        INNER JOIN suppliers ON suppliers.id=product_availability.supp_id
        INNER JOIN order_items ON order_items.product_id=product_availability.prod_id
        INNER JOIN orders ON orders.id=order_items.order_id 
        INNER JOIN customers ON customers.id=orders.customer_id
      WHERE customer_id= $1`;

//------------------Utility functions------------------------
function isValidID(id) {
  return !isNaN(id) && id >= 0;
}

function productStringValidator(string) {
  const regexp = /^[a-zA-Z0-9 -]{1,100}$/
  if (typeof string !== "string" && !(string instanceof String)) {
    return false;
  }
  if (!string.match(regexp)) {
    return false;
  }
  return true;
}

function getStringValidator(string) { // validator for the get end points
  const regexp = /^[a-zA-Z0-9 -]$/;
  
  if (typeof string !== "string" && !(string instanceof String)) {
    return false;
  }
  if (!string.match(regexp)) {
    return false;
  }
  return true;
}


//---------------Validator solely for validating---------------
function nameStringValidator(string, characterLength) {
  const regexp = /^[a-zA-Z ]$/;
  if (string.length > characterLength) {
    return false;
  }
  if (typeof string !== "string" && !(string instanceof String)) {
    return false;
  }
  if (!string.match(regexp)) {
    return false;
  }
  return true;
}

//----------------Invalid------------------------------------
const invalidOrderMessage = { message: "Invalid order id" };

//------------------------------------GET----------------------------------------------------------

// Read - get all products & filter products by name
app.get("/products", async (req, res) => {
  let productName = req.query.name;

  if (productName) {
    if (!getStringValidator(productName)) {
      res.status(400).send({ message: `Invalid product name ${productName}` });
      return;
    }
    selectProductsQuery = `${selectProductsQuery} WHERE product_name ILIKE '%${productName}%'`;
  }

  pool
    .query(selectProductsQuery)
    .then((result) => {
      res.json(result.rows)
    })
    .catch((e) => {
      res.status(500).send(e);
      console.error(e);
    });
});

// Read- get all customer data
app.get("/customers", async (req, res) => {
  try {
    const result = await pool.query(customersSelectQuery);
    res.send(result.rows);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Read -get a single customer data by id
app.get("/customers/:customerId", function (req, res) {
  const customerId = parseInt(req.params.customerId);

  if (isNaN(customerId) || customerId <= 0) {
    res.status(400).send({ message: `Bad customer ID: ${customerId}` });
    return;
  }

  pool
    .query(`SELECT * FROM customers WHERE id= $1`, [customerId])
    .then((result) => {
      res.json(result.rows);
    })
    .catch((e) => console.error(e));
});

// Read-  get a customer order by id
app.get("/customers/:customerId/orders", function (req, res) {
  const customerId = parseInt(req.params.customerId);

  if (!isValidID(customerId)) {
    res.status(400).send({ message: `Bad customer ID: ${customerId}` });
    return; //
  }

  pool
    .query(customerSelectIdOrdersQuery, [customerId])
    .then((result) => res.json(result.rows))
    .catch((e) => {
      console.error(e);
      res.status(400).send(e);
    });
});

//------------------------------------POST----------------------------------------------------------

//Create- Create new customer entry
app.post("/customers", function (req, res) {
  console.log(req.body)
  const newCustomerId = parseInt(req.body.id);
  const newCustomerName = req.body.name;
  const newCustomerAddress = req.body.address;
  const newCustomerCity = req.body.city;
  const newCustomerCountry = req.body.country;
  if (!Number.isInteger(newCustomerId) || newCustomerId <= 0) {
    return res.status(400).send({
      message: `The customer id ${newCustomerId} should be a positive integer.`,
    });
  }

  pool
    .query("SELECT * FROM customers WHERE id=$1", [newCustomerId])
    .then((result) => {
      if (result.rows.length > 0) {
        return res.status(400).send({
          message: `FATAL ERROR: A customer with the same id ${newCustomerId} already exists!`,
        });
      }
    });

  if (newCustomerName) {
    if (!nameStringValidator(newCustomerName,50)) {
      res.status(400).send({
        message: `Invalid customer name ${newCustomerName} only English characters are accepted and there is a limit of 50 characters`,
      });
      return;
    }
  }

  if (newCustomerCity) {
    if (!nameStringValidator(newCustomerCity,30)) {
      res.status(400).send({
        message: `Invalid  city name ${newCustomerCity} only English characters are accepted and there is a limit of 30 characters`,
      });
      return;
    }
  }

  if (newCustomerCountry) {
    if (!nameStringValidator(newCustomerCountry,20)) {
      res.status(400).send({
        message: `Invalid  country name ${newCustomerCountry} only English characters are accepted and there is a limit of 20 characters`,
      });
      return;
    }
  }

  pool
    .query("SELECT * FROM customers WHERE name=$1", [newCustomerName])
    .then((result) => {
      if (result.rows.length > 0) {
        return res.status(400).send({
          message: `FATAL ERROR: A customer with the same name ${newCustomerName} already exists!`,
        });
      } else {
        const query =
          "INSERT INTO customers (id, name, address, city, country) VALUES ($1, $2, $3, $4,$5)";
        pool
          .query(query, [
            newCustomerId,
            newCustomerName,
            newCustomerAddress,
            newCustomerCity,
            newCustomerCountry,
          ])
          .then(() =>
            res.send({ message: `New customer data has been created!` })
          )
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send({ message: "Internal Server Error" });
          });
      }
    });
});

app.post("/products", function (req, res) {
  const newProductName = req.body.product_name;

  if (newProductName) {
    if (!productStringValidator(newProductName)) {
      res.status(400).send({
        message: `Invalid product name ${newProductName} only English characters are accepted and there is a limit of 100 characters`,
      });
      return;
    }
  }

  pool
    .query(`SELECT * FROM products WHERE product_name=$1`, [newProductName])
    .then((result) => {
      if (result.rows.length > 0) {
        return res
          .status(400)
          .send({ message: `This product ${newProductName} already exists!` });
      } else {
        const insertProductQuery = `INSERT INTO products (product_name) VALUES ($1)`;

        pool
          .query(insertProductQuery, [newProductName])
          .then(() =>
            res.send({
              message: `New product ${newProductName} has been created!`,
            })
          )
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send({ message: "Internal Server Error" });
          });
      }
    });
});

app.post("/availability", function (req, res) {
  const newUnitProdId = parseInt(req.body.prod_id);
  const newSupplierId = parseInt(req.body.supp_id);
  const newUnitPrice = parseFloat(req.body.unit_price);

  if (!isValidID(newUnitProdId)) {
    res.status(400).send({ message: `Bad product ID: ${newUnitProdId}` });
    return; //
  }

  if (!isValidID(newSupplierId)) {
    res.status(400).send({ message: `Bad supplier ID: ${newSupplierId}` });
    return; //
  }

  if (!Number.isInteger(newUnitPrice) || newUnitPrice <= 0) {
    return res
      .status(400)
      .send("The the unit price must be a positive integer.");
  }

  // Error handler for product id
  pool
    .query("SELECT * FROM products WHERE id=$1", [newUnitProdId])
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(400).send({
          message: `FATAL ERROR: This product ${newUnitProdId} does not exist!`,
        });
      }
    });

  //Error handler for supplier id
  pool
    .query("SELECT * FROM suppliers WHERE id=$1", [newSupplierId])
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(400).send({
          message: `FATAL ERROR: This supplier ${newSupplierId} does not exist`,
        });
      }
    });

  pool
    .query(
      "SELECT * FROM product_availability WHERE prod_id=$1 AND supp_id=$2",
      [newUnitProdId, newSupplierId]
    )
    .then((result) => {
      console.log(result);
      if (result.rows.length > 0) {
        return res.status(400).send({
          message: `ALERT: The combination of Product id ${newUnitProdId} and Supplier id ${newSupplierId} already exist please a put method update the values`,
        });
      }
    });
  
  const insertProductAvailabilityQuery =
    "INSERT INTO product_availability (prod_id, supp_id, unit_price) VALUES ($1, $2, $3)";
  pool
    .query(insertProductAvailabilityQuery, [
      newUnitProdId,
      newSupplierId,
      newUnitPrice,
    ])
    .then(() => res.send({ message: `new product availability created!` }))
    .catch((e) => {
      console.error(e.stack);
      res.status(500).send({ message: "Internal Server Error" });
    });
});


app.post("/customers/:customerId/orders", function (req, res) {
  const newCustomerId = parseInt(req.params.customerId);
  const newOrderDate = new Date().toISOString();
  const newOrderReference = req.body.order_reference;
 
if (!Number.isInteger(newCustomerId) || newCustomerId <= 0) {
    return res
      .status(400)
      .send("The number for the customer ID should be a positive integer.");
  }

  pool
    .query("SELECT * FROM customers WHERE id=$1", [newCustomerId])
    .then((result) => {
      if (result.rows.length === 0) {
        return res
          .status(400)
          .send(
            "This customer does not exist please checked the values in your order!"
          );
      } else {
        const query =
          "INSERT INTO orders (customer_id, order_date, order_reference) VALUES ($1, $2, $3)";
        pool
          .query(query, [newCustomerId, newOrderDate, newOrderReference])
          .then(() => res.send("customer order created!"))
          .catch((e) => {
            console.log(e);
            res.send(e);
          });
      }
    });
});

//------------------------------------------PUT-------------------------------------------------------
app.put("/customers/:customerId", function (req, res) {
  const customerId = parseInt(req.params.customerId);
  const customerName = req.body.name;
  const customerAddress = req.body.address;
  const customerCity = req.body.city;
  const customerCountry = req.body.country;

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res
      .status(400)
      .send({ message: "Invalid customer id, check your input data" });
  }
  // result.
  pool
    .query(
      "UPDATE customers SET name=$1, address=$2, city=$3, country=$4 WHERE id=$5",
      [customerName, customerAddress, customerCity, customerCountry, customerId]
    )
    .then((result) => {
      if (result.rowCount === 0) {
        return res
          .status(400)
          .send("This customer does not exist please check your data!");
      } else {
        res.send(`Customer ${customerId} updated!`);
      }
    })
    .catch((e) => console.error(e));
});

//----------------------------------------DELETE--------------------------------------------------------

app.delete("/orders/:orderId", function (req, res) {
  const orderId = parseInt(req.params.orderId);

  if (!isValidID(orderId)) {
    res.status(404).send(invalidOrderMessage);
    return;
  }
  pool
    .query("DELETE FROM order_items WHERE order_id=$1", [orderId])
    .then(() => {
      pool
        .query("DELETE FROM orders WHERE id=$1", [orderId])
        .then(() =>
          res.send(
            `Order ${orderId} has been successfully deleted from the database !`
          )
        )
        .catch((e) => console.error(e));
    })
    .catch((e) => console.error(e));
});

app.delete("/customers/:customerId", function (req, res) {
  const customerId = parseInt(req.params.customerId);

  if (!isValidID(customerId)) {
    res.status(404).send(customerNotFoundMessage);
    return;
  }

  pool
    .query("SELECT FROM orders WHERE customer_id=$1", [customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        return res
          .status(400)
          .send(
            `This Customer ${customerId} has existing orders and cannot be deleted`
          );
      }

      pool
        .query("DELETE FROM customers WHERE id=$1", [customerId])
        .then(() =>
          res.send(
            `Customer ${customerId} deleted because they have no orders!`
          )
        )
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send({ message: "Internal Server Error" });
        });
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send({ message: "Internal Server Error" });
    });
});

app.listen(4010, function () {
  console.log("Server is listening on port 4010. Ready to accept requests!");
});
