class Order {
  constructor(peerId, price, quantity, type, sequenceNumber) {
    this.peerId = peerId;
    this.price = price;
    this.quantity = quantity;
    this.type = type;
    this.sequenceNumber = sequenceNumber;
    this.timestamp = new Date().toISOString();
    this.id = this.generateOrderId();
  }

  generateOrderId() {
    return `order_${this.peerId}_${this.timestamp.replace(/[^0-9]/g, '')}_${this.sequenceNumber}`;
  }
}
module.exports = Order;
