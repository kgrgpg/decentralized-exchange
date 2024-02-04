// Red-black tree implementation of order book
const RBTree = require('bintrees').RBTree;
const { Subject } = require('rxjs');

// Sort buy orders by descending price, then ascending order ID
function compareBuyOrders(a, b) {
  if (b.price !== a.price) return b.price - a.price;
  return a.id.localeCompare(b.id);
}

// Sort sell orders by ascending price, then ascending order ID
function compareSellOrders(a, b) {
  if (a.price !== b.price) return a.price - b.price;
  return a.id.localeCompare(b.id);
}

// Sort orders by ascending order ID
function compareOrdersById(a, b) {
  return a.id.localeCompare(b.id);
}

const buyOrders = new RBTree(compareBuyOrders);
const sellOrders = new RBTree(compareSellOrders);
const ordersById = new RBTree(compareOrdersById);

/**
 * addOrderToBook
 * 
 * Functions like addOrderToBook and deleteOrderFromBook help encapsulate operations on order books 
 * Making it easier to ensure atomicity when modifying multiple trees.
 * 
 * @param {Order} order - The order to be added
 */
function addOrderToBook(order) {
  if (order.type === 'buy') {
    buyOrders.insert(order);
  } else {
    sellOrders.insert(order);
  }
  ordersById.insert(order);
}

function deleteOrderFromBook(order) {
  if (order.type === 'buy') {
    buyOrders.remove(order);
  } else {
    sellOrders.remove(order);
  }
  ordersById.remove(order);
}

/**
 * matchAndExecuteOrder
 * 
 * Matches an order with the opposite side of the order book and executes the trade if possible.
 * If the order is not fully matched, it is added to the order book.
 * 
 * @param {Order} newOrder - The order to be matched and executed
 */
function matchAndExecuteOrder(newOrder) {
  const oppositeBook = newOrder.type === 'buy' ? sellOrders : buyOrders;
  let currentBestMatch = newOrder.type === 'buy' ? oppositeBook.min() : oppositeBook.max();

  while (currentBestMatch) {
    // Determine if current best match is valid based on order type and price
    const isValidMatch = newOrder.type === 'buy' ? newOrder.price >= currentBestMatch.price 
                                                  : newOrder.price <= currentBestMatch.price;

    if (!isValidMatch) break;

    if (newOrder.quantity <= currentBestMatch.quantity) {
      console.log(`Full or partial match found for order ${newOrder.id} with ${currentBestMatch.id}, executing trade.`);
      currentBestMatch.quantity -= newOrder.quantity;
      if (currentBestMatch.quantity === 0) {
        oppositeBook.remove(currentBestMatch);
        ordersById.remove(currentBestMatch.id);
      }
      newOrder.quantity = 0;
      break; // Order fully matched
    } else {
      console.log(`Partial match found for order ${newOrder.id} with ${currentBestMatch.id}, executing trade.`);
      newOrder.quantity -= currentBestMatch.quantity;
      oppositeBook.remove(currentBestMatch);
      ordersById.remove(currentBestMatch.id);
    }

    // Move to next best match
    currentBestMatch = newOrder.type === 'buy' ? oppositeBook.min() : oppositeBook.max();
  }

  if (newOrder.quantity > 0) {
    console.log(`No (further) match found for order ${newOrder.id}, adding to book.`);
    addOrderToBook(newOrder);
  }
}


function addOrder(order) {
  console.log(`Adding order: ${order.id}`);
  matchAndExecuteOrder(order);
}

function deleteOrder(orderId) {
  console.log(`Deleting order: ${orderId}`);
  const order = ordersById.find({ id: orderId });
  if (!order) {
    console.log("Order not found.");
    return;
  }
  deleteOrderFromBook(order);
}

function treeToArray(tree) {
  const result = [];
  tree.each(node => result.push(node));
  return result;
}

// Define subjects
const addOrderSubject$ = new Subject();
const deleteOrderSubject$ = new Subject();

// Subscription to handle addition of orders
addOrderSubject$.subscribe(order => {
    console.log(`Processing order addition: ${order.id}`);
    addOrder(order); // Assuming addOrder is adapted to work with this setup
});

// Function to emit order additions
function emitAddOrder(order) {
    addOrderSubject$.next(order);
}

// Subscription to handle deletion of orders
deleteOrderSubject$.subscribe(orderId => {
  console.log(`Processing order deletion: ${orderId}`);
  deleteOrder(orderId); // Assuming deleteOrder is a function that handles the deletion logic
});

// Function to emit deletion requests into the stream
function emitDeleteOrder(orderId) {
  deleteOrderSubject$.next(orderId);
}

module.exports = { addOrder, deleteOrder, emitAddOrder, emitDeleteOrder, treeToArray };
