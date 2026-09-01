import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './routes/Home.jsx';
import Menu from './routes/Menu.jsx';
import Item from './routes/Item.jsx';
import Checkout from './routes/Checkout.jsx';
import OrderManage from './routes/OrderManage.jsx';
import NotFound from './routes/NotFound.jsx';

/* Route changes must move the viewport and the reader's focus to the top of the
   new view. Without this a screen reader stays parked wherever the last link
   was, and the page silently swaps underneath it. */
function RouteChange() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    // On FIRST paint, leave focus alone. Moving it to <main> on load puts the
    // whole header — skip link included — behind the user's first Tab, which is
    // exactly the trap the skip link exists to avoid.
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <RouteChange />
      <Header />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu/:locationId" element={<Menu />} />
          <Route path="/menu/:locationId/item/:itemId" element={<Item />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders/:orderId" element={<OrderManage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
