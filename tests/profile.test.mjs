import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedGoals, profileFromForm } from '../assets/profile.js';
import { emptyState, validateState } from '../assets/storage.js';

test('legacy custom goals remain available as Other; new multi-selections survive storage validation', () => {
  assert.deepEqual(selectedGoals({ goal: 'Track sleep patterns' }), ['other']);
  assert.deepEqual(selectedGoals({ goal: '' }), []);
  const form = new FormData();
  form.set('name', ' Sample ');form.set('age', '30');form.append('trackingGoals', 'headaches');
  form.append('trackingGoals', 'other');form.set('goal', ' Track sleep ');
  const profile = profileFromForm(form);
  assert.deepEqual(profile, { name: 'Sample', age: 30, trackingGoals: ['headaches', 'other'], goal: 'Track sleep' });
  assert.doesNotThrow(() => validateState({ ...emptyState(), profile }));
  for (const trackingGoals of [['unknown'], ['headaches','headaches'], null])
    assert.throws(() => validateState({ ...emptyState(), profile: { ...profile, trackingGoals } }));
  form.delete('trackingGoals');form.append('trackingGoals', 'migraines');
  assert.equal(profileFromForm(form).goal, '');
});
