// Run: npm run test:unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wingOf } from './wing.js';

test('the event wing or type decides before the community', () => {
  assert.equal(wingOf({ wing: 'cultural', community_id: 1, community_wing: 'games' }), 'cultural');
  assert.equal(
    wingOf({ community_id: 2, community_wing: 'tech', event_type: 'Guest Talk' }),
    'talks'
  );
});

test('a community wing decides when the event has no wing or known type', () => {
  assert.equal(
    wingOf({ community_id: 7, community_wing: 'girls', event_type: 'Girls Night' }),
    'girls'
  );
  assert.equal(
    wingOf({ community_id: 99, community_wing: 'games', event_type: 'Mystery' }),
    'games'
  );
});

test('a community id alone never picks a wing', () => {
  assert.equal(wingOf({ community_id: 4, event_type: 'Mystery' }), 'cultural');
});

test('a house-wide event without a known type or wing is talks', () => {
  assert.equal(wingOf({ community_id: null, event_type: 'Meetup' }), 'talks');
});

test('esports and technical names map to their wings', () => {
  assert.equal(wingOf({ wing: 'esports' }), 'games');
  assert.equal(wingOf({ wing: 'technical' }), 'tech');
});
