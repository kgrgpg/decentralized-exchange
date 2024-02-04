// Red-black tree implementation of order book
const RBTree = require('bintrees').RBTree;
// Import necessary functions and operators from RxJS
const { Subject, merge } = require('rxjs');
const { bufferTime, map } = require('rxjs/operators');

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

// Function to compare orders based on timestamp and sequenceNumber
function compareOrdersByTimeSeq(a, b) {
  if (a.timestamp === b.timestamp) {
    return a.sequenceNumber - b.sequenceNumber;
  }
  return new Date(a.timestamp) - new Date(b.timestamp);
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

// Function to emit order additions
function emitAddOrder(order) {
    addOrderSubject$.next(order);
}

// Function to emit deletion requests into the stream
function emitDeleteOrder(orderId) {
  deleteOrderSubject$.next(orderId);
}

// Merging the add and delete streams, buffer them, and then sort each batch before processing
const orderOperationsStream$ = merge(
  addOrderSubject$.pipe(map(order => ({...order, type: 'add'}))), // Mark each order addition with a type
  deleteOrderSubject$.pipe(map(deletion => ({...deletion, type: 'delete'}))) // Mark each deletion with a type
).pipe(
  bufferTime(1000),
  map(bufferedOperations => bufferedOperations.sort(compareOrdersByTimeSeq)) // Sort operations by timestamp and sequenceNumber
);

// Process the sorted and buffered orders
orderOperationsStream$.subscribe(sortedOperations => {
  sortedOperations.forEach(operation => {
    if (operation.type === 'add') {
      console.log(`Processing addition: ${operation.payload.id}`);
      addOrderToBook(operation.payload);
    } else if (operation.type === 'delete') {
      console.log(`Processing deletion: ${operation.payload.orderId}`);
      // Find the order by ID and check timestamp before deletion
      const orderToDelete = ordersById.find({id: operation.payload.orderId});
      if (orderToDelete && orderToDelete.timestamp <= operation.payload.timestamp) {
        deleteOrderFromBook(operation.payload.orderId);
      }
    }
  });
});

module.exports = { addOrder, deleteOrder, emitAddOrder, emitDeleteOrder, treeToArray };
