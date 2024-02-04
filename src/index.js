  // Example usage
  addOrder(new Order('1', 100, 10, 'buy'));
  addOrder(new Order('2', 101, 5, 'sell'));
  console.log('Buy Orders:', treeToArray(buyOrders));
  console.log('Sell Orders:', treeToArray(sellOrders));
  console.log('Orders by ID:', treeToArray(ordersById));
  
  deleteOrder('1');
  console.log('After Deletion - Buy Orders:', treeToArray(buyOrders));

  