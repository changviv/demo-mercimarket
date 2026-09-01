/* Merci Market catering menu — 76 items across 8 categories, transcribed from
   catering38.mercimarketnyc.com. Prices stripped out of description text,
   supplier boilerplate removed, and the "choose N" rules that the live site
   buries in prose promoted to structured `groups` the UI can enforce.

   The empty "Sides Snacks" category is dropped — it occupied a nav slot and
   contained nothing.

   Two items carry `dataFlag`: pricing on the live site that looks wrong and
   needs the client to confirm before launch. They render as an amber note.

   In production this shape is produced by the server from Toast Menus API v3
   (see server/lib/toast.js -> normalizeMenu). This file is the fallback used
   when Toast is unreachable, and the fixture the UI is developed against. */

import { OPTION_POOLS } from './options.js';

export const MENU = [
  {
    "id": "breakfast-platters",
    "name": "Breakfast Platters",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "homemade-oatmeal",
        "name": "Homemade Oatmeal",
        "price": 7.5,
        "desc": "With brown sugar, mixed nuts, raisins, and cranberries.",
        "groups": []
      },
      {
        "id": "yogurt-parfait",
        "name": "Yogurt Parfait",
        "price": 7.5,
        "desc": "Yogurt, granola, and mixed fruit.",
        "groups": []
      },
      {
        "id": "novie-platter",
        "name": "Novie Platter",
        "price": 23.99,
        "desc": "Assorted bagels, smoked salmon, tomato, red onion, lemon, and your choice of cream cheese.",
        "popular": true,
        "groups": [
          {
            "id": "cc",
            "title": "Cream cheese",
            "type": "one",
            "req": true,
            "pool": "CC"
          }
        ]
      },
      {
        "id": "bagel-platter",
        "name": "Bagel Platter",
        "price": 8.5,
        "desc": "Assorted bagels, served with your choice of cream cheese, butter, and jelly.",
        "vegetarian": true,
        "groups": [
          {
            "id": "cc",
            "title": "Cream cheese",
            "type": "one",
            "req": true,
            "pool": "CC"
          }
        ]
      },
      {
        "id": "morning-breakfast",
        "name": "Morning Breakfast",
        "price": 10.99,
        "desc": "Assorted bagels, pastries and muffins, cream cheese, butter, jelly, and your choice of beverage.",
        "popular": true,
        "rule": "Choose 1 beverage",
        "groups": [
          {
            "id": "bev",
            "title": "Beverage",
            "type": "one",
            "req": true,
            "pool": "BEV"
          }
        ]
      },
      {
        "id": "fresh-start-breakfast",
        "name": "Fresh Start Breakfast",
        "price": 13.99,
        "desc": "Assorted bagels, pastries and muffins, cream cheese, butter, jelly, fruit salad, and your choice of beverage.",
        "popular": true,
        "rule": "Choose 1 beverage",
        "groups": [
          {
            "id": "bev",
            "title": "Beverage",
            "type": "one",
            "req": true,
            "pool": "BEV"
          }
        ]
      },
      {
        "id": "room-breakfast",
        "name": "Room Breakfast",
        "price": 17.99,
        "desc": "Assorted bagels, pastries and muffins, cream cheese, butter, jelly, fruit salad, your choice of beverage, and orange juice pints.",
        "popular": true,
        "rule": "Choose up to 2 beverages",
        "groups": [
          {
            "id": "bev",
            "title": "Beverages",
            "type": "upto",
            "max": 2,
            "req": true,
            "pool": "BEV"
          }
        ]
      },
      {
        "id": "breakfast-wraps",
        "name": "Breakfast Wraps",
        "price": 11.99,
        "desc": "Your choice of wraps.",
        "groups": [
          {
            "id": "wrap",
            "title": "Wraps",
            "type": "upto",
            "max": 0,
            "req": true,
            "pool": "WRAPS"
          }
        ]
      },
      {
        "id": "hungry-breakfast",
        "name": "Hungry Breakfast",
        "price": 23.99,
        "desc": "Egg sandwiches, assorted bagels, pastries and muffins, cream cheese, butter, jelly, fruit salad, your choice of beverage, and orange juice pints.",
        "groups": [
          {
            "id": "bev",
            "title": "Beverages",
            "type": "upto",
            "max": 2,
            "req": true,
            "pool": "BEV"
          }
        ]
      },
      {
        "id": "egg-sandwiches",
        "name": "Egg Sandwiches",
        "price": 9.99,
        "desc": "With your choice of protein or cheese.",
        "rule": "Choose up to 5",
        "groups": [
          {
            "id": "fill",
            "title": "Proteins and cheeses",
            "type": "upto",
            "max": 5,
            "req": true,
            "pool": "FILL"
          }
        ]
      },
      {
        "id": "fresh-baked-platter",
        "name": "Fresh Baked Platter",
        "price": 8.5,
        "desc": "Assorted bagels, pastries, and muffins. Served with cream cheese, butter, and jelly.",
        "groups": []
      },
      {
        "id": "egg-breakfast-platter",
        "name": "Egg Breakfast Platter",
        "price": 14.5,
        "desc": "Scrambled eggs, bacon, turkey bacon, sausage, ham, home fries, and toast.",
        "groups": []
      },
      {
        "id": "continental-breakfast",
        "name": "Continental Breakfast",
        "price": 16.99,
        "desc": "Assorted bagels, pastries and muffins, cream cheese, butter, jelly, your choice of beverage, and orange juice pints.",
        "popular": true,
        "rule": "Choose up to 2 beverages",
        "groups": [
          {
            "id": "bev",
            "title": "Beverages",
            "type": "upto",
            "max": 2,
            "req": true,
            "pool": "BEV"
          }
        ]
      },
      {
        "id": "fruit-platter",
        "name": "Fruit Platter",
        "price": 9.5,
        "desc": "Assorted seasonal fruit.",
        "vegetarian": true,
        "groups": []
      }
    ]
  },
  {
    "id": "individual-breakfast",
    "name": "Individual Breakfast",
    "note": "Individually packed",
    "min": 1,
    "indiv": true,
    "items": [
      {
        "id": "individual-charcuterie-cups",
        "name": "Individual Charcuterie Cups",
        "price": 10.99,
        "desc": "Crackers, grapes, strawberry, mixed nuts, and cheese in a personal cup.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "greek-omelet",
        "name": "Greek Omelet",
        "price": 9.3,
        "desc": "Two eggs, black olives, tomato, and feta cheese. Served with home fries and your choice of toast.",
        "popular": true,
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "spanish-omelet",
        "name": "Spanish Omelet",
        "price": 9.3,
        "desc": "Two eggs, tomato, and red onion. Served with home fries and your choice of toast.",
        "popular": true,
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "garden-omelet",
        "name": "Garden Omelet",
        "price": 9.3,
        "desc": "Two eggs, broccoli, spinach, red onion, bell peppers, and mushrooms. Served with home fries and your choice of toast.",
        "popular": true,
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "western-omelet",
        "name": "Western Omelet",
        "price": 9.3,
        "desc": "Two eggs, ham, bell peppers, and red onions. Served with home fries and your choice of toast.",
        "popular": true,
        "groups": []
      },
      {
        "id": "the-wagner-egg-sandwich",
        "name": "The Wagner Egg Sandwich",
        "price": 10.95,
        "desc": "Two eggs, bacon, American cheese, and pepperoni.",
        "groups": []
      },
      {
        "id": "steak-cheesy-egg-sandwich",
        "name": "Steak Cheesy Egg Sandwich",
        "price": 10.95,
        "desc": "Two eggs, thin-sliced beef, and extra American cheese.",
        "groups": []
      },
      {
        "id": "breakfast-burrito",
        "name": "Breakfast Burrito",
        "price": 10.95,
        "desc": "Two eggs, bacon, pepper jack cheese, black beans, and salsa.",
        "groups": []
      },
      {
        "id": "lovely-becca-egg-sandwich",
        "name": "Lovely Becca Egg Sandwich",
        "price": 10.95,
        "desc": "Two eggs, avocado, tomato, pepper jack cheese, and hash brown.",
        "vegetarian": true,
        "groups": []
      }
    ]
  },
  {
    "id": "boxed-lunches",
    "name": "Boxed Lunches",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "sandwich-a-boxed-lunch",
        "name": "Sandwich A Boxed Lunch",
        "price": 23.99,
        "desc": "An assorted sandwich, a bag of chips, and a small fruit salad.",
        "groups": []
      },
      {
        "id": "sandwich-b-boxed-lunch",
        "name": "Sandwich B Boxed Lunch",
        "price": 24.99,
        "desc": "An assorted sandwich, a small salad, and a small bag of cookies.",
        "groups": []
      }
    ]
  },
  {
    "id": "sandwich-platters",
    "name": "Sandwich Platters",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "signature-sandwich-package",
        "name": "Signature Sandwich Package",
        "price": 14.99,
        "desc": "Assorted signature sandwiches.",
        "groups": []
      },
      {
        "id": "uno-classic-sandwich-package",
        "name": "Uno Classic Sandwich Package",
        "price": 19.99,
        "desc": "Assorted signature sandwiches and your choice of side.",
        "popular": true,
        "rule": "Choose 1 side",
        "groups": [
          {
            "id": "sides",
            "title": "Side",
            "type": "one",
            "req": true,
            "pool": "SIDES"
          }
        ]
      },
      {
        "id": "dos-classic-sandwich-package",
        "name": "Dos Classic Sandwich Package",
        "price": 21.99,
        "desc": "Assorted signature sandwiches and your choice of two sides.",
        "popular": true,
        "rule": "Choose up to 3 sides",
        "groups": [
          {
            "id": "sides",
            "title": "Sides",
            "type": "upto",
            "max": 3,
            "req": true,
            "pool": "SIDES"
          }
        ]
      },
      {
        "id": "all-out-sandwich-package",
        "name": "All Out Sandwich Package",
        "price": 27.99,
        "desc": "Assorted signature sandwiches and your choice of three sides.",
        "popular": true,
        "rule": "Choose up to 3 sides",
        "groups": [
          {
            "id": "sides",
            "title": "Sides",
            "type": "upto",
            "max": 3,
            "req": true,
            "pool": "SIDES"
          }
        ]
      }
    ]
  },
  {
    "id": "sandwiches-wraps",
    "name": "Sandwiches & Wraps",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "nebraska-sandwich",
        "name": "Nebraska Sandwich",
        "price": 10.95,
        "desc": "Smoked ham and turkey, Swiss cheese, coleslaw, and Russian dressing on rye.",
        "groups": []
      },
      {
        "id": "chicken-cordon-bleu-sandwich",
        "name": "Chicken Cordon Bleu Sandwich",
        "price": 10.95,
        "desc": "Crispy chicken cutlet, ham, melted Swiss cheese, lettuce, and tomato on a roll.",
        "groups": []
      },
      {
        "id": "chicken-parmigiana-sandwich",
        "name": "Chicken Parmigiana Sandwich",
        "price": 10.95,
        "desc": "Chicken fingers, fresh mozzarella, and tomato sauce.",
        "groups": []
      },
      {
        "id": "new-york-reuben-sandwich",
        "name": "New York Reuben Sandwich",
        "price": 10.95,
        "desc": "Corned beef, Swiss cheese, sauerkraut, and Russian dressing on rye.",
        "groups": []
      },
      {
        "id": "tuna-delight-sandwich",
        "name": "Tuna Delight Sandwich",
        "price": 10.95,
        "desc": "Tuna, alfalfa sprouts, Monterey Jack cheese, tomato, and cucumber on pita.",
        "groups": []
      },
      {
        "id": "spicy-cajun-chicken-sandwich",
        "name": "Spicy Cajun Chicken Sandwich",
        "price": 10.95,
        "desc": "Cajun grilled chicken, pepper jack cheese, lettuce, tomato, and hot peppers on a hero.",
        "groups": []
      },
      {
        "id": "noviac-sandwich",
        "name": "Noviac Sandwich",
        "price": 10.95,
        "desc": "Smoked salmon, cream cheese, tomato, and onion on a bagel.",
        "groups": []
      },
      {
        "id": "teriyaki-chicken-wrap",
        "name": "Teriyaki Chicken Wrap",
        "price": 10.95,
        "desc": "Teriyaki chicken, fresh mozzarella, lettuce, tomato, and grilled onions.",
        "groups": []
      },
      {
        "id": "wild-buffalo-wrap",
        "name": "Wild Buffalo Wrap",
        "price": 10.95,
        "desc": "Crispy chicken cutlet, crumbled bleu cheese, lettuce, tomato, and Buffalo sauce.",
        "groups": []
      },
      {
        "id": "smoked-turkey-sandwich",
        "name": "Smoked Turkey Sandwich",
        "price": 10.95,
        "desc": "Smoked turkey, Brie, lettuce, and tomato on a hero.",
        "groups": []
      },
      {
        "id": "capri-sandwich",
        "name": "Capri Sandwich",
        "price": 10.95,
        "desc": "Fresh mozzarella, basil, and sun-dried tomato.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "turkey-club-sandwich",
        "name": "Turkey Club Sandwich",
        "price": 10.95,
        "desc": "Turkey, bacon, lettuce, and tomato on white bread.",
        "groups": []
      },
      {
        "id": "black-and-white-sandwich",
        "name": "Black & White Sandwich",
        "price": 10.95,
        "desc": "Smoked turkey and ham, mozzarella, lettuce, and tomato.",
        "groups": []
      },
      {
        "id": "italian-sub",
        "name": "Italian Sub",
        "price": 10.95,
        "desc": "Prosciutto, capicola, Genoa salami, provolone, lettuce, tomato, and roasted red pepper.",
        "groups": []
      },
      {
        "id": "chicken-club-wrap",
        "name": "Chicken Club Wrap",
        "price": 10.95,
        "desc": "Chicken salad, bacon, lettuce, and tomato.",
        "groups": []
      },
      {
        "id": "chicken-cheddar-sandwich",
        "name": "Chicken Cheddar Sandwich",
        "price": 10.95,
        "desc": "Crispy chicken, cheddar, bacon, lettuce, and tomato on a hero.",
        "groups": []
      },
      {
        "id": "smokehouse-sandwich",
        "name": "Smokehouse Sandwich",
        "price": 10.95,
        "desc": "Crispy chicken cutlet, pastrami, fresh mozzarella, lettuce, tomato, and pickle on a hero.",
        "groups": []
      },
      {
        "id": "tavern-tuna-wrap",
        "name": "Tavern Tuna Wrap",
        "price": 10.95,
        "desc": "Tuna salad, cucumber, tomato, carrots, alfalfa sprouts, and Dijon mustard.",
        "groups": []
      },
      {
        "id": "chicken-caesar-wrap",
        "name": "Chicken Caesar Wrap",
        "price": 10.95,
        "desc": "Chopped grilled chicken, romaine, Parmesan, croutons, and Caesar dressing.",
        "groups": []
      },
      {
        "id": "classic-grilled-chicken-sandwich",
        "name": "Classic Grilled Chicken Sandwich",
        "price": 10.95,
        "desc": "Grilled chicken, fresh mozzarella, lettuce, tomato, and sun-dried tomato on rye.",
        "groups": []
      },
      {
        "id": "fire-roasted-veggie-wrap",
        "name": "Fire Roasted Veggie Wrap",
        "price": 10.95,
        "desc": "Roasted mixed vegetables, fresh mozzarella, and spicy seasoning.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "chickavo-wrap",
        "name": "Chickavo Wrap",
        "price": 10.95,
        "desc": "Grilled chicken, avocado, mixed greens, roasted red peppers, and ranch dressing.",
        "groups": []
      },
      {
        "id": "the-godfather-sandwich",
        "name": "The Godfather Sandwich",
        "price": 10.95,
        "desc": "Hot roast beef, melted mozzarella, grilled onions, and roasted red peppers on a hero.",
        "groups": []
      },
      {
        "id": "pesto-chicken-sandwich",
        "name": "Pesto Chicken Sandwich",
        "price": 10.95,
        "desc": "Pesto chicken, fresh mozzarella, roasted red peppers, and spinach.",
        "groups": []
      },
      {
        "id": "murray-hill-special-sandwich",
        "name": "Murray Hill Special Sandwich",
        "price": 10.95,
        "desc": "Grilled turkey, provolone, lettuce, and tomato on a hero.",
        "groups": []
      }
    ]
  },
  {
    "id": "salad-platters",
    "name": "Salad Platters",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "caesar-salad",
        "name": "Caesar Salad",
        "price": 8.5,
        "desc": "Romaine with croutons and Parmesan.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "garden-salad",
        "name": "Garden Salad",
        "price": 8.5,
        "desc": "Romaine with black olives, carrots, cucumbers, bell peppers, and grape tomatoes.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "greek-salad",
        "name": "Greek Salad",
        "price": 9.5,
        "desc": "Romaine with black olives, carrots, cucumbers, bell peppers, grape tomatoes, and feta.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "spring-salad",
        "name": "Spring Salad",
        "price": 9.5,
        "desc": "With dried cranberries, green grapes, walnuts, and crumbled bleu cheese.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "kale-caesar-salad",
        "name": "Kale Caesar Salad",
        "price": 17.99,
        "desc": "Kale with grilled chicken, croutons, and Parmesan.",
        "groups": []
      },
      {
        "id": "asian-sesame-salad",
        "name": "Asian Sesame Salad",
        "price": 17.99,
        "desc": "With grilled chicken, cashews, scallion, and bell peppers.",
        "groups": []
      },
      {
        "id": "cobb-salad",
        "name": "Cobb Salad",
        "price": 17.99,
        "desc": "With grilled chicken, crumbled bleu cheese, bacon, avocado, hard-boiled eggs, and tomato.",
        "groups": []
      },
      {
        "id": "chef-salad",
        "name": "Chef Salad",
        "price": 17.99,
        "desc": "With ham, turkey, salami, American cheese, fresh mozzarella, bell peppers, tomato, black olives, carrots, cucumber, and hard-boiled eggs.",
        "groups": []
      }
    ]
  },
  {
    "id": "hors-doeuvres",
    "name": "Hors d'Oeuvres",
    "note": "Minimum 8 people",
    "min": 8,
    "indiv": false,
    "items": [
      {
        "id": "crudite-platter",
        "name": "Crudite Platter",
        "price": 5.99,
        "desc": "Loaded with vegetables and Mediterranean favorites. A make-ahead appetizer for a crowd.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "hummus-and-pita-platter",
        "name": "Hummus and Pita Platter",
        "price": 5.99,
        "desc": "Hummus and pita with fresh vegetables, falafel, feta, and a drizzle of olive oil.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "guac-and-chips",
        "name": "Guac & Chips",
        "price": 5.99,
        "desc": "Avocado, onion, jalapeno, cilantro, lime juice, salt, and pepper. Served with tortilla chips.",
        "vegetarian": true,
        "groups": []
      },
      {
        "id": "cheese-and-cracker-platter",
        "name": "Cheese and Cracker Platter",
        "price": 12.99,
        "desc": "An assortment of fine cheeses, artisan charcuterie, and paired accompaniments such as nuts and dried fruits.",
        "groups": []
      },
      {
        "id": "antipasto-platter",
        "name": "Antipasto Platter",
        "price": 14.99,
        "desc": "Packed with flavor, color, and texture. Kicks off a party Italian-style.",
        "groups": []
      },
      {
        "id": "charcuterie-board",
        "name": "Charcuterie Board",
        "price": 22.99,
        "desc": "Meats, seasonal farmer's market fruit, honey or jam or whole grain mustard, olives, cornichons, pickled mustard seeds, dried fruit, and assorted nuts.",
        "groups": []
      },
      {
        "id": "smoked-salmon-platter",
        "name": "Smoked Salmon Platter",
        "price": 25.99,
        "desc": "Cold and hot smoked salmon, colorful vegetables, and a cream cheese spread.",
        "dataFlag": "Listed as $2599 on the live site — assumed $25.99",
        "groups": []
      }
    ]
  },
  {
    "id": "beverages",
    "name": "Beverages",
    "note": "Priced per person unless noted",
    "min": 1,
    "indiv": false,
    "items": [
      {
        "id": "small-poland-spring-water",
        "name": "Small Poland Spring Water",
        "price": 1.5,
        "desc": "500ml bottle.",
        "groups": []
      },
      {
        "id": "bottled-water",
        "name": "Bottled Water",
        "price": 2.49,
        "desc": "Larger format.",
        "dataFlag": "Live site shows a $2.49 – $3.75 range with no sizes named",
        "groups": []
      },
      {
        "id": "assorted-individual-sodas",
        "name": "Assorted Individual Sodas",
        "price": 3.9,
        "desc": "Assorted flavors.",
        "groups": []
      },
      {
        "id": "tropicana-orange-juice",
        "name": "Tropicana Orange Juice",
        "price": 3.99,
        "desc": "Individual bottles.",
        "groups": []
      },
      {
        "id": "fresh-squeezed-orange-juice",
        "name": "Fresh-Squeezed Orange Juice",
        "price": 6.99,
        "desc": "Squeezed in store.",
        "groups": []
      },
      {
        "id": "box-of-herbal-tea",
        "name": "Box of Herbal Tea",
        "price": 25.99,
        "desc": "Serves 12.",
        "unit": "box",
        "serves": 12,
        "groups": []
      },
      {
        "id": "box-of-coffee",
        "name": "Box of Coffee",
        "price": 31.99,
        "desc": "Serves 12.",
        "unit": "box",
        "serves": 12,
        "rule": "Choose one coffee type per container",
        "groups": [
          {
            "id": "coffee",
            "title": "Coffee type",
            "type": "one",
            "req": true,
            "pool": "COFFEE"
          }
        ]
      }
    ]
  }
];

/** Resolve a group's option pool name into its actual choices. */
export function groupOptions(group) {
  return OPTION_POOLS[group.pool] || [];
}

export function allItems() {
  return MENU.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id, categoryName: c.name, min: c.min })));
}

export function findItem(itemId) {
  for (const c of MENU) {
    const i = c.items.find((x) => x.id === itemId);
    if (i) return { ...i, categoryId: c.id, categoryName: c.name, min: c.min, note: c.note };
  }
  return null;
}

export function findCategory(categoryId) {
  return MENU.find((c) => c.id === categoryId) || null;
}
