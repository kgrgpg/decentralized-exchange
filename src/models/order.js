class Order {
    constructor(id, price, quantity, type) {
      this.id = id;
      this.price = price;
      this.quantity = quantity;
      this.type = type; // 'buy' or 'sell'
    }
  }
  
  module.exports = Order;
  