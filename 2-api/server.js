require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const app = express();

const cors = require("cors");
app.use(express.json());
app.use(cors({ origin: "*" }));

const pool = new Pool();

//-----------------SQL queries-----------------------------
const customersSelectQuery = `SELECT * FROM customers`;
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


const suppliersSelectQuery = `SELECT * FROM suppliers`;
const productsSelectQuery = `
SELECT
  p.product_name,
  p_a.unit_price,
  suppliers.supplier_name
FROM product_availability AS p_a
  INNER JOIN products AS p ON p.id=p_a.prod_id
  INNER JOIN suppliers ON  suppliers.id=p_a.supp_id`;



const productsByNameSelectorQuery = `SELECT * FROM products`;

//------------------Utility function------------------------

function isValidID(id) {
  return !isNaN(id) && id >= 0;
}

function isValidSupplier(supplier) {
  // Only accept letters, numbers, white space and dash characters
  const regexp = /^[a-zA-Z0-9 -]{1,60}$/;
  return (
    supplier.match && // Make sure the match method exists
    supplier.match(regexp)
  ); // Execute regular expression matching
}

//----------------Invalid------------------------------------
const invalidOrderMessage = { message: "Invalid order id" };

//Task 1 load all products with their names, prices and supplier names
// app.get("/products", async (req, res) => {
//   try {
//     const result = await pool.query(productsSelectQuery);
//     res.send(result.rows);
//   } catch (error) {
//     res.status(500).send(error);
//   }
// });

//------------------------------------GET----------------------------------------------------------
// Read - **Task 1** get all products &  **Task 2** filter product names
// app.get("/products", function (req, res) {
//   let productQuery = req.query.name;
//   let query = `SELECT * FROM products
//   `;
//   //   let query = `SELECT p.id, p.product_name, p_a.unit_price, suppliers.supplier_name FROM product_availability AS p_a
//   // INNER JOIN products AS p ON p.id=p_a.prod_id
//   // INNER JOIN suppliers ON  suppliers.id=p_a.supp_id`;
//   if (productQuery) {
//     query = `SELECT * FROM products WHERE product_name ILIKE '%${productQuery}%'`;
//   }
//   pool
//     .query(query)
//     .then((result) => res.json(result.rows))
//     .catch((e) => console.error(e));
// });

/*
// Future reference:  deduplicating code

let query = `SELECT * FROM products AS p
  INNER JOIN product_availability AS p_a ON p_a.prod_id=p.id
  INNER JOIN suppliers As s ON  s.id=p_a.supp_id `;

  if (productName) {
    query = query + ` WHERE product_name ILIKE '%${productName}%'`;
  }
*/

app.get("/products", async (req, res) => {
  let productName = req.query.name;
  if (!isValidSupplier(productName)) {
    res.status(400).send("Invalid product name");
    return;
  }

  let query = `
  SELECT
    * FROM products AS p
    INNER JOIN product_availability AS p_a ON p_a.prod_id=p.id
    INNER JOIN suppliers As s ON  s.id=p_a.supp_id `;

  if (productName) {
    query = `
    SELECT *FROM products AS p
      INNER JOIN product_availability AS p_a ON p_a.prod_id=p.id
      INNER JOIN suppliers As s ON  s.id=p_a.supp_id
    WHERE product_name ILIKE '%${productName}%'`;
  }
  pool
    .query(query)
    .then((result) => res.json(result.rows))
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

app.get("/customers/:customerId", function (req, res) {
  const customerId = parseInt(req.params.customerId);

  if (isNaN(customerId) || customerId <= 0) {
    res.status(400).send(`Bad customer ID: ${customerId}`);
    return;
  }

  pool
    .query(`SELECT * FROM customers WHERE id= $1`, [customerId])
    .then((result) => {
      res.json(result.rows);
    })
    .catch((e) => console.error(e));
});

// Read- **Task 11** get all customer data
app.get("/customers/:customerId/orders", function (req, res) {
  const customerId = parseInt(req.params.customerId);

  if (!isValidID(customerId)) {
    res.status(400).send(`Bad customer ID: ${customerId}`);
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
  const newCustomerId = parseInt(req.body.id);
  const newCustomerName = req.body.name;
  const newCustomerAddress = req.body.address;
  const newCustomerCity = req.body.city;
  const newCustomerCountry = req.body.country;

  if (!Number.isInteger(newCustomerId) || newCustomerId <= 0) {
    return res
      .status(400)
      .send("The customer id should be a positive integer.");
  }

  pool
    .query("SELECT * FROM customers WHERE name=$1", [newCustomerName])
    .then((result) => {
      if (result.rows.length > 0) {
        return res
          .status(400)
          .send("A customer with the same name already exists!");
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
          .then(() => res.send("New customer created!"))
          .catch((e) => console.error(e));
      }
    });
});

app.post("/products", function (req, res) {
  const newProductName = req.body.product_name;

  if (newProductName <= 0) {
    return res.status(400).send("The product id should be a positive integer.");
  }

  pool
    .query(`SELECT * FROM products WHERE product_name=$1`, [newProductName])
    .then((result) => {
      if (result.rows.length > 0) {
        return res.status(400).send("This product already exists!");
      } else {
        const query = `INSERT INTO products (product_name) VALUES ($1)`;

        pool
          .query(query, [newProductId, newProductName])
          .then(() => res.send("New product has been created!"))
          .catch((e) => console.error(e));
      }
    });
});

/*
Add a new POST endpoint /availability to create a new product availability 
(with a price and a supplier id). Check that the price is a positive integer 
and that both the product and supplier ID's exist in the database, otherwise return an error.
*/

// app.post("/availability", function (req, res) {
//   const newUnitProdId = req.body.prod_id;
//   const newSupplierId = req.body.supp_id;
//   const newUnitPrice = req.body.unit_price;
//   const query =
//     "INSERT INTO product_availability (prod_id, supp_id, unit_price) VALUES ($1, $2, $3)";

//   pool
//     .query(query, [newUnitProdId, newSupplierId, newUnitPrice])
//     .then(() => res.send("new product availability created!"))
//     .catch((e) => console.error(e));
// });

app.post("/availability", function (req, res) {
  const newUnitProdId = req.body.prod_id;
  const newSupplierId = req.body.supp_id;
  const newUnitPrice = req.body.unit_price;

  //prod_id
  if (!Number.isInteger(newUnitPrice) || newUnitPrice <= 0) {
    return res
      .status(400)
      .send("The the unit price must be a positive integer.");
  }

  pool
    .query(
      "SELECT * FROM product_availability WHERE prod_id=$1 AND supp_id=$2",
      [newUnitProdId, newSupplierId]
    )
    .then((result) => {
      if (result.rows.length > 0) {
        return res
          .status(400)
          .send("A price already exists for this supplier please use update!");
      } else {
        const query =
          "INSERT INTO product_availability (prod_id, supp_id, unit_price) VALUES ($1, $2, $3)";
        pool
          .query(query, [newUnitProdId, newSupplierId, newUnitPrice])
          .then(() => res.send("new product availability created!"))
          .catch((e) => res.send(e));
      }
    });
});

/*
Add a new POST endpoint /customers/:customerId/orders to create a new order 
(including an order date, and an order reference) for a customer. 
Check that the customerId corresponds to an existing customer or return an error.
*/

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
      // console.log(result.rowCount.length)

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

/*
Add a new PUT endpoint /customers/:customerId to update an existing customer (name, address, city and country).
*/

//----------------------------------------DELETE--------------------------------------------------------

//Add a new DELETE endpoint /orders/:orderId 
//to delete an existing order along with all 
//the associated order items.

const orderDeleteQuery = `
DELETE *
  FROM orders As o
  iNNER JOIN order_items As o_i ON o_i.id=o.id
WHERE o.id=1;`;

app.delete("/orders/:orderId", function (req, res) {
  const orderId = parseInt(req.params.customerId);
  if (!isValidID(orderId)) {
    res.status(404).send(invalidOrderMessage);
    return;
  }
  pool
    .query(orderDeleteQuery, [orderId])
    .then(() => {
      pool
        .query(orderDeleteQuery, [orderId])
        .then(() => res.send(`Order id ${orderId} has been deleted!`))
        .catch((e) => {
          console.error(e);
          res.send(e);
        });
    })
    .catch((e) => {
      console.error(e);
      res.send(e);
    });
});


//Add a new DELETE endpoint /customers/:customerId to delete an existing customer only if this customer doesn't have orders.

const customerNotFoundMessage = { message: "customer not found" };

app.delete("/customers/:customerId", function (req, res) {
  const customerId = parseInt(req.params.customerId);
  if (!isValidID(customerId)) {
    res.status(404).send(customerNotFoundMessage);
    return;
  }

  if (customerId) {
    
  }

  pool
    .query("DELETE FROM bookings WHERE customer_id=$1", [customerId])
    .then(() => {
      pool
        .query("DELETE FROM customers WHERE id=$1", [customerId])
        .then(() => res.send(`Customer ${customerId} deleted!`))
        .catch((e) => console.error(e));
    })
    .catch((e) => console.error(e));
});


/*

if customer id !==order{
  
}
*/


app.listen(4010, function () {
  console.log("Server is listening on port 4010. Ready to accept requests!");
});
// const listener = app.listen(process.env.PORT || 4005, function () {
//   console.log("Your app is listening on port " + listener.address().port);
// });
