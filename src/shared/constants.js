/**
 * Shared constants used across the application.
 * Single source of truth for food images, API endpoints, and configuration values.
 */

// Food image URLs for animated icons (used in landing, chat, and challenges)
export const foodImages = [
  'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046771.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046755.png',
  'https://cdn-icons-png.flaticon.com/512/135/135728.png',
  'https://cdn-icons-png.flaticon.com/512/6301/6301302.png',
  'https://cdn-icons-png.flaticon.com/512/5344/5344260.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046748.png',
  'https://cdn-icons-png.flaticon.com/512/6108/6108623.png',
  'https://cdn-icons-png.flaticon.com/512/2909/2909761.png',
  'https://cdn-icons-png.flaticon.com/512/1102/1102780.png',
];

// API endpoint configuration
export const API_ENDPOINTS = {
  chat: '/api/chat',
  gemini: '/api/gemini',
  authConfig: '/api/auth/config',
  authSession: '/api/auth/session',
  billingCheckout: '/api/billing/checkout',
  billingPortal: '/api/billing/portal',
};
