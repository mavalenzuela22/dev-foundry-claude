import { createPlan } from './plan.js';

// Section 5.5: plan --remove is the inverse plan; apply executes it like any other plan.
export const createRemovePlan = (options) => createPlan({ ...options, remove: true });
