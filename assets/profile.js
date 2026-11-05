export const TRACKING_GOALS = [
  { id: 'headaches', label: 'Headaches' },
  { id: 'migraines', label: 'Migraines' },
  { id: 'triggers', label: 'Possible triggers' },
  { id: 'medication_relief', label: 'Medication relief' },
  { id: 'other', label: 'Other' },
];

export function selectedGoals(profile) {
  return profile.trackingGoals ?? (profile.goal ? ['other'] : []);
}

export function profileFromForm(data) {
  const trackingGoals = data.getAll('trackingGoals');
  return {
    name: data.get('name').trim(),
    age: data.get('age') === '' ? '' : Number(data.get('age')),
    trackingGoals,
    goal: trackingGoals.includes('other') ? data.get('goal').trim() : '',
  };
}
