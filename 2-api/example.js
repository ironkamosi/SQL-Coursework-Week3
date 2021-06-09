app.post("/hotels", function (req, res) {
  const newHotelName = req.body.name;
  const newHotelRooms = req.body.rooms;
  const newHotelPostcode = req.body.postcode;

  if (!Number.isInteger(newHotelRooms) || newHotelRooms <= 0) {
    return res
      .status(400)
      .send("The number of rooms should be a positive integer.");
  }

  pool
    .query("SELECT * FROM hotels WHERE name=$1", [newHotelName])
    .then((result) => {
      if (result.rows.length > 0) {
        return res
          .status(400)
          .send("An hotel with the same name already exists!");
      } else {
        const query =
          "INSERT INTO hotels (name, rooms, postcode) VALUES ($1, $2, $3)";
        pool
          .query(query, [newHotelName, newHotelRooms, newHotelPostcode])
          .then(() => res.send("Hotel created!"))
          .catch((e) => console.error(e));
      }
    });
});

pool
  .query(
    "SELECT COUNT (prod_id) FROM product_availability WHERE prod_id=$1 AND supp_id=$2",
    [newSupplierId, newUnitProdId]
  )
  .then((result) => {
    console.log(result);
    if (result.rowCount.length > 0) {
      return res.status(400).send({
        message: `ALERT: The combination of Product id and Supplier id already exist please a put method update the values`,
      });
    }
  });