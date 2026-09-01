/* Server-side price lookup, keyed by item id.

   Generated from the same transcription that produces src/data/menu.js. It
   exists so the server never trusts a price posted by a browser: the client
   sends item ids and quantities, the server looks up what those cost.

   When Toast is configured this file is bypassed entirely — Toast prices the
   order. It is the fallback, and the guard against a tampered basket. */

export const MENU_FIXTURE = {
  "homemade-oatmeal": {
    "name": "Homemade Oatmeal",
    "price": 7.5,
    "unit": "person"
  },
  "yogurt-parfait": {
    "name": "Yogurt Parfait",
    "price": 7.5,
    "unit": "person"
  },
  "novie-platter": {
    "name": "Novie Platter",
    "price": 23.99,
    "unit": "person"
  },
  "bagel-platter": {
    "name": "Bagel Platter",
    "price": 8.5,
    "unit": "person"
  },
  "morning-breakfast": {
    "name": "Morning Breakfast",
    "price": 10.99,
    "unit": "person"
  },
  "fresh-start-breakfast": {
    "name": "Fresh Start Breakfast",
    "price": 13.99,
    "unit": "person"
  },
  "room-breakfast": {
    "name": "Room Breakfast",
    "price": 17.99,
    "unit": "person"
  },
  "breakfast-wraps": {
    "name": "Breakfast Wraps",
    "price": 11.99,
    "unit": "person"
  },
  "hungry-breakfast": {
    "name": "Hungry Breakfast",
    "price": 23.99,
    "unit": "person"
  },
  "egg-sandwiches": {
    "name": "Egg Sandwiches",
    "price": 9.99,
    "unit": "person"
  },
  "fresh-baked-platter": {
    "name": "Fresh Baked Platter",
    "price": 8.5,
    "unit": "person"
  },
  "egg-breakfast-platter": {
    "name": "Egg Breakfast Platter",
    "price": 14.5,
    "unit": "person"
  },
  "continental-breakfast": {
    "name": "Continental Breakfast",
    "price": 16.99,
    "unit": "person"
  },
  "fruit-platter": {
    "name": "Fruit Platter",
    "price": 9.5,
    "unit": "person"
  },
  "individual-charcuterie-cups": {
    "name": "Individual Charcuterie Cups",
    "price": 10.99,
    "unit": "person"
  },
  "greek-omelet": {
    "name": "Greek Omelet",
    "price": 9.3,
    "unit": "person"
  },
  "spanish-omelet": {
    "name": "Spanish Omelet",
    "price": 9.3,
    "unit": "person"
  },
  "garden-omelet": {
    "name": "Garden Omelet",
    "price": 9.3,
    "unit": "person"
  },
  "western-omelet": {
    "name": "Western Omelet",
    "price": 9.3,
    "unit": "person"
  },
  "the-wagner-egg-sandwich": {
    "name": "The Wagner Egg Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "steak-cheesy-egg-sandwich": {
    "name": "Steak Cheesy Egg Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "breakfast-burrito": {
    "name": "Breakfast Burrito",
    "price": 10.95,
    "unit": "person"
  },
  "lovely-becca-egg-sandwich": {
    "name": "Lovely Becca Egg Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "sandwich-a-boxed-lunch": {
    "name": "Sandwich A Boxed Lunch",
    "price": 23.99,
    "unit": "person"
  },
  "sandwich-b-boxed-lunch": {
    "name": "Sandwich B Boxed Lunch",
    "price": 24.99,
    "unit": "person"
  },
  "signature-sandwich-package": {
    "name": "Signature Sandwich Package",
    "price": 14.99,
    "unit": "person"
  },
  "uno-classic-sandwich-package": {
    "name": "Uno Classic Sandwich Package",
    "price": 19.99,
    "unit": "person"
  },
  "dos-classic-sandwich-package": {
    "name": "Dos Classic Sandwich Package",
    "price": 21.99,
    "unit": "person"
  },
  "all-out-sandwich-package": {
    "name": "All Out Sandwich Package",
    "price": 27.99,
    "unit": "person"
  },
  "nebraska-sandwich": {
    "name": "Nebraska Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "chicken-cordon-bleu-sandwich": {
    "name": "Chicken Cordon Bleu Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "chicken-parmigiana-sandwich": {
    "name": "Chicken Parmigiana Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "new-york-reuben-sandwich": {
    "name": "New York Reuben Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "tuna-delight-sandwich": {
    "name": "Tuna Delight Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "spicy-cajun-chicken-sandwich": {
    "name": "Spicy Cajun Chicken Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "noviac-sandwich": {
    "name": "Noviac Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "teriyaki-chicken-wrap": {
    "name": "Teriyaki Chicken Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "wild-buffalo-wrap": {
    "name": "Wild Buffalo Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "smoked-turkey-sandwich": {
    "name": "Smoked Turkey Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "capri-sandwich": {
    "name": "Capri Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "turkey-club-sandwich": {
    "name": "Turkey Club Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "black-and-white-sandwich": {
    "name": "Black & White Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "italian-sub": {
    "name": "Italian Sub",
    "price": 10.95,
    "unit": "person"
  },
  "chicken-club-wrap": {
    "name": "Chicken Club Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "chicken-cheddar-sandwich": {
    "name": "Chicken Cheddar Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "smokehouse-sandwich": {
    "name": "Smokehouse Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "tavern-tuna-wrap": {
    "name": "Tavern Tuna Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "chicken-caesar-wrap": {
    "name": "Chicken Caesar Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "classic-grilled-chicken-sandwich": {
    "name": "Classic Grilled Chicken Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "fire-roasted-veggie-wrap": {
    "name": "Fire Roasted Veggie Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "chickavo-wrap": {
    "name": "Chickavo Wrap",
    "price": 10.95,
    "unit": "person"
  },
  "the-godfather-sandwich": {
    "name": "The Godfather Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "pesto-chicken-sandwich": {
    "name": "Pesto Chicken Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "murray-hill-special-sandwich": {
    "name": "Murray Hill Special Sandwich",
    "price": 10.95,
    "unit": "person"
  },
  "caesar-salad": {
    "name": "Caesar Salad",
    "price": 8.5,
    "unit": "person"
  },
  "garden-salad": {
    "name": "Garden Salad",
    "price": 8.5,
    "unit": "person"
  },
  "greek-salad": {
    "name": "Greek Salad",
    "price": 9.5,
    "unit": "person"
  },
  "spring-salad": {
    "name": "Spring Salad",
    "price": 9.5,
    "unit": "person"
  },
  "kale-caesar-salad": {
    "name": "Kale Caesar Salad",
    "price": 17.99,
    "unit": "person"
  },
  "asian-sesame-salad": {
    "name": "Asian Sesame Salad",
    "price": 17.99,
    "unit": "person"
  },
  "cobb-salad": {
    "name": "Cobb Salad",
    "price": 17.99,
    "unit": "person"
  },
  "chef-salad": {
    "name": "Chef Salad",
    "price": 17.99,
    "unit": "person"
  },
  "crudite-platter": {
    "name": "Crudite Platter",
    "price": 5.99,
    "unit": "person"
  },
  "hummus-and-pita-platter": {
    "name": "Hummus and Pita Platter",
    "price": 5.99,
    "unit": "person"
  },
  "guac-and-chips": {
    "name": "Guac & Chips",
    "price": 5.99,
    "unit": "person"
  },
  "cheese-and-cracker-platter": {
    "name": "Cheese and Cracker Platter",
    "price": 12.99,
    "unit": "person"
  },
  "antipasto-platter": {
    "name": "Antipasto Platter",
    "price": 14.99,
    "unit": "person"
  },
  "charcuterie-board": {
    "name": "Charcuterie Board",
    "price": 22.99,
    "unit": "person"
  },
  "smoked-salmon-platter": {
    "name": "Smoked Salmon Platter",
    "price": 25.99,
    "unit": "person"
  },
  "small-poland-spring-water": {
    "name": "Small Poland Spring Water",
    "price": 1.5,
    "unit": "person"
  },
  "bottled-water": {
    "name": "Bottled Water",
    "price": 2.49,
    "unit": "person"
  },
  "assorted-individual-sodas": {
    "name": "Assorted Individual Sodas",
    "price": 3.9,
    "unit": "person"
  },
  "tropicana-orange-juice": {
    "name": "Tropicana Orange Juice",
    "price": 3.99,
    "unit": "person"
  },
  "fresh-squeezed-orange-juice": {
    "name": "Fresh-Squeezed Orange Juice",
    "price": 6.99,
    "unit": "person"
  },
  "box-of-herbal-tea": {
    "name": "Box of Herbal Tea",
    "price": 25.99,
    "unit": "box"
  },
  "box-of-coffee": {
    "name": "Box of Coffee",
    "price": 31.99,
    "unit": "box"
  }
};
