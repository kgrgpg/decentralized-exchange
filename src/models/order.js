class Order {
  constructor(peerId, price, quantity, type, sequenceNumber) {
    this.peerId = peerId;
    this.price = price;
    this.quantity = quantity;
    this.type = type; //Buy or Sell
    this.sequenceNumber = sequenceNumber; // Sequence number for ordering
    this.timestamp = new Date().toISOString(); // Timestamp for order creation
    this.id = this.generateOrderId();
  }

  generateOrderId() {
    // Generates a unique ID for the order using peerId, timestamp, and sequenceNumber
    return `order_${this.peerId}_${this.timestamp.replace(/[^0-9]/g, '')}_${this.sequenceNumber}`;
  }
}
module.exports = Order;
