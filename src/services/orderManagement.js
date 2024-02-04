// Initialize three red-black trees: one for buy orders, one for sell orders, and one for orders sorted by ID.
const RBTree = require('bintrees').RBTree;
const Order = require('./models/order');

function compareOrders(a, b) {
  return a.price - b.price;
}

function compareOrdersById(a, b) {
  return a.id.localeCompare(b.id);
}

const buyOrders = new RBTree(compareOrders);
const sellOrders = new RBTree(compareOrders);
const ordersById = new RBTree(compareOrdersById);

// Implement functions to atomically add, delete, and modify orders in these trees.
function addOrder(order) {
    if (order.type === 'buy') {
      buyOrders.insert(order);
    } else if (order.type === 'sell') {
      sellOrders.insert(order);
    }
    ordersById.insert(order);
  }
  
  function deleteOrder(orderId) {
    const order = ordersById.find({ id: orderId });
    if (!order) return;
  
    if (order.type === 'buy') {
      buyOrders.remove(order);
    } else if (order.type === 'sell') {
      sellOrders.remove(order);
    }
    ordersById.remove(order);
  }

  // Helper Function to Convert RBTree to Array
  function treeToArray(tree) {
    const result = [];
    tree.each(node => result.push(node));
    return result;
  }
  
  // Export the functions
  module.exports = { addOrder, deleteOrder};
