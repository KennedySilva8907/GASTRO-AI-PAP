/**
 * Matter.js Physics Engine Setup for Chat Page
 * Manages food icon animations with collision physics
 */

// Matter.js component references (from global CDN)
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;

// Physics configuration
const BASE_SPEED = 0.12;
const ICON_SIZE = 65;
const ICON_COUNT = 13;
const COLLISION_PULSE_SCALE = 1.1;
const COLLISION_PULSE_DURATION = 100;

/**
 * Wraps food icons within screen boundaries (teleport effect)
 * @param {Matter.Body[]} foods - Array of food bodies
 * @param {object} bounds - Width and height of canvas
 */
function wrapFoods(foods, bounds) {
  const { width, height } = bounds;
  foods.forEach((food) => {
    const { x, y } = food.position;
    if (x < 0) Body.setPosition(food, { x: width, y: y });
    if (x > width) Body.setPosition(food, { x: 0, y: y });
    if (y < 0) Body.setPosition(food, { x: x, y: height });
    if (y > height) Body.setPosition(food, { x: x, y: 0 });
  });
}

/**
 * Maintains constant velocity for all food icons
 * @param {Matter.Body[]} foods - Array of food bodies
 */
function maintainConstantSpeed(foods) {
  foods.forEach((food) => {
    const velocity = food.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed !== BASE_SPEED) {
      const factor = BASE_SPEED / speed;
      Body.setVelocity(food, {
        x: velocity.x * factor,
        y: velocity.y * factor,
      });
    }
  });
}

/**
 * Creates collision pulse effect on food icons
 * @param {Matter.Body} body - Food body to animate
 */
function applyCollisionPulse(body) {
  body.render.sprite.xScale *= COLLISION_PULSE_SCALE;
  body.render.sprite.yScale *= COLLISION_PULSE_SCALE;

  setTimeout(() => {
    body.render.sprite.xScale /= COLLISION_PULSE_SCALE;
    body.render.sprite.yScale /= COLLISION_PULSE_SCALE;
  }, COLLISION_PULSE_DURATION);
}

/**
 * Reflects velocity vectors on collision
 * @param {Matter.Body} bodyA - First colliding body
 * @param {Matter.Body} bodyB - Second colliding body
 */
function reflectVelocities(bodyA, bodyB) {
  const collisionVector = {
    x: bodyB.position.x - bodyA.position.x,
    y: bodyB.position.y - bodyA.position.y,
  };

  const magnitude = Math.sqrt(
    collisionVector.x * collisionVector.x + collisionVector.y * collisionVector.y
  );
  const normalizedVector = {
    x: collisionVector.x / magnitude,
    y: collisionVector.y / magnitude,
  };

  const dotProductA = bodyA.velocity.x * normalizedVector.x + bodyA.velocity.y * normalizedVector.y;
  const dotProductB = bodyB.velocity.x * normalizedVector.x + bodyB.velocity.y * normalizedVector.y;

  Body.setVelocity(bodyA, {
    x: bodyA.velocity.x - 2 * dotProductA * normalizedVector.x,
    y: bodyA.velocity.y - 2 * dotProductA * normalizedVector.y,
  });

  Body.setVelocity(bodyB, {
    x: bodyB.velocity.x - 2 * dotProductB * normalizedVector.x,
    y: bodyB.velocity.y - 2 * dotProductB * normalizedVector.y,
  });

  const separation = 1.01;
  Body.setPosition(bodyA, {
    x: bodyA.position.x - normalizedVector.x * separation,
    y: bodyA.position.y - normalizedVector.y * separation,
  });
  Body.setPosition(bodyB, {
    x: bodyB.position.x + normalizedVector.x * separation,
    y: bodyB.position.y + normalizedVector.y * separation,
  });
}

/**
 * Handles collisions between food icons
 * @param {Matter.Engine.Event} event - Collision event
 * @param {Matter.Body[]} foods - Array of food bodies
 */
function handleCollision(event, foods) {
  const pairs = event.pairs;
  for (let i = 0; i < pairs.length; i++) {
    const bodyA = pairs[i].bodyA;
    const bodyB = pairs[i].bodyB;

    if (foods.includes(bodyA) && foods.includes(bodyB)) {
      reflectVelocities(bodyA, bodyB);
      applyCollisionPulse(bodyA);
      applyCollisionPulse(bodyB);
    }
  }
}

/**
 * Creates a food body with random position and velocity
 * @param {string[]} foodImages - Array of food image URLs
 * @param {number} index - Food icon index
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {Matter.Body} Food body
 */
function createFoodBody(foodImages, index, canvasWidth, canvasHeight) {
  const x = Math.random() * canvasWidth;
  const y = Math.random() * canvasHeight;

  const food = Bodies.circle(x, y, ICON_SIZE / 2, {
    render: {
      sprite: {
        texture: foodImages[index % foodImages.length],
        xScale: ICON_SIZE / 256,
        yScale: ICON_SIZE / 256,
      },
    },
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    inertia: Infinity,
    slop: 0,
  });

  const angle = Math.random() * Math.PI * 2;
  Body.setVelocity(food, {
    x: Math.cos(angle) * BASE_SPEED,
    y: Math.sin(angle) * BASE_SPEED,
  });

  return food;
}

/**
 * Handles mouse drag end event for throwing food icons
 * @param {Matter.Body} body - Food body being dragged
 */
function handleMouseThrow(body) {
  const mouseVelocity = event.mouse.mouseupPosition;
  const bodyPosition = body.position;
  const throwVector = {
    x: (mouseVelocity.x - bodyPosition.x) * 0.05,
    y: (mouseVelocity.y - bodyPosition.y) * 0.05,
  };

  const speed = Math.sqrt(throwVector.x * throwVector.x + throwVector.y * throwVector.y);
  const factor = BASE_SPEED / speed;
  Body.setVelocity(body, {
    x: throwVector.x * factor,
    y: throwVector.y * factor,
  });
}

/**
 * Sets up event listeners for physics engine
 * @param {Matter.Engine} engine - Physics engine
 * @param {Matter.Render} render - Renderer
 * @param {Matter.Body[]} foods - Food bodies
 * @param {Matter.MouseConstraint} mouseConstraint - Mouse constraint
 */
function setupPhysicsEvents(engine, render, foods, mouseConstraint) {
  Events.on(engine, 'afterUpdate', () => {
    wrapFoods(foods, render.options);
    maintainConstantSpeed(foods);
  });

  Events.on(engine, 'collisionStart', (event) => {
    handleCollision(event, foods);
  });

  Events.on(mouseConstraint, 'enddrag', (event) => {
    const body = event.body;
    if (foods.includes(body)) {
      handleMouseThrow(body);
    }
  });
}

/**
 * Initializes Matter.js physics engine and food animations
 * @param {HTMLElement} containerElement - DOM element for canvas
 * @param {string[]} foodImages - Array of food image URLs
 * @returns {object} Cleanup function and engine reference
 */
export function initPhysics(containerElement, foodImages) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const world = engine.world;

  const render = Render.create({
    element: containerElement,
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: 'transparent',
    },
  });

  const foods = [];
  for (let i = 0; i < ICON_COUNT; i++) {
    const food = createFoodBody(foodImages, i, window.innerWidth, window.innerHeight);
    foods.push(food);
  }

  World.add(world, foods);

  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false },
    },
  });

  World.add(world, mouseConstraint);
  render.mouse = mouse;

  setupPhysicsEvents(engine, render, foods, mouseConstraint);

  Engine.run(engine);
  Render.run(render);

  return {
    cleanup: () => {
      Render.stop(render);
      Engine.clear(engine);
      render.canvas.remove();
    },
  };
}
