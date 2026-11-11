// The numeric parameters that may be formulas, with the range each needs proven (5.6.7). Taken from the capability
// schemas: effects (A1.1, spec/2.0/schemas/capabilities/effects.schema.json) and physics (A4.2, physics.schema.json).
// A test compares this table with those schemas, so a change in the spec shows up as a failing test.
// { range: [lo, hi] } is one number; { each: [lo, hi] } is a list whose entries are each a number or a formula.
export const EFFECT_PARAMS = {"particles":{"seed":{"range":[0,4294967295],"formula":false},"count":{"range":[1,64],"formula":false},"position":{"each":[-1000000,1000000]},"speed":{"each":[-1000000,1000000]},"angle":{"each":[-1000000,1000000]},"spin":{"each":[-720,720]},"gravity":{"range":[-10000,10000],"formula":true},"lifeMs":{"range":[1,5000],"formula":true},"delayMs":{"range":[0,5000],"formula":true},"emitMs":{"range":[0,5000],"formula":true},"durationMs":{"range":[1,600000],"formula":false}}};
// physics: addons.physics.bodies.<id>.<key>. The inputs of physics.throw and physics.kick are typed by the manifest's
// calls (D28, sites.mjs).
export const PHYSICS_BODY_PARAMS = { rest: { each: [-1000000, 1000000] }, gravity: { each: [-10000, 10000] }, bounce: { range: [0, 1] }, friction: { range: [0, 100] } };
