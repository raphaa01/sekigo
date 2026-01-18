import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

/**
 * Footer Component
 * 
 * Footer with Impressum link and copyright
 */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__content">
        <Link to="/impressum" className="footer__link">
          Impressum
        </Link>
        <span className="footer__copyright">
          © 2026 SekiGo
        </span>
      </div>
    </footer>
  );
}

export default Footer;
