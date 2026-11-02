// An event's wing: its poster colour, label and filter. The first rule that applies wins:
//   1. the event's own wing, or its type (a Workshop is tech, a Guest Talk is talks);
//   2. the community's wing, from the database (communities.wing, sent as community_wing);
//   3. a house-wide event (no community) is talks;
//   4. anything else is cultural.
// A new community gets its wing in the database. Never map community ids here.
export const WINGS = {
  cultural: { label: 'Cultural' },
  games: { label: 'Games & Sports' },
  tech: { label: 'Tech' },
  talks: { label: 'Talks' },
  girls: { label: 'Girls' },
};

// Names the sheets and the Lounge use for a wing.
const WING_ALIAS = { esports: 'games', technical: 'tech' };

const WING_OF_TYPE = {
  'Guest Talk': 'talks',
  Empowerment: 'talks',
  Sports: 'games',
  'E-Sports': 'games',
  Technical: 'tech',
  Hackathon: 'tech',
  Workshop: 'tech',
  Cultural: 'cultural',
};

const asWing = (value) => {
  const wing = WING_ALIAS[value] ?? value;
  return WINGS[wing] ? wing : null;
};

export function wingOf(e) {
  return (
    asWing(e.wing) ??
    WING_OF_TYPE[e.event_type || e.type] ??
    asWing(e.community_wing) ??
    (e.community_id ? 'cultural' : 'talks')
  );
}
