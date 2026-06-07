export type FeaturedEventRoom = {
  id: string;
  name: string;
  teamLabel: string;
  friends: string[];
};

export type FeaturedEvent = {
  id: string;
  name: string;
  subtitle: string;
  startsAtLabel: string;
  botLabel: string;
  statusLabel: string;
  rooms: FeaturedEventRoom[];
};

export const FEATURED_EVENTS: FeaturedEvent[] = [
  {
    id: "world-cup-final",
    name: "World Cup Final",
    subtitle: "Event rooms only through friends or your own invite link.",
    startsAtLabel: "Featured event",
    botLabel: "World Cup Bot",
    statusLabel: "Lobby",
    rooms: [],
  },
  {
    id: "super-bowl",
    name: "Super Bowl",
    subtitle: "Jump into friend rooms. No stranger lobby.",
    startsAtLabel: "National game",
    botLabel: "Super Bowl Bot",
    statusLabel: "Coming up",
    rooms: [],
  },
  {
    id: "masters-sunday",
    name: "Masters Sunday",
    subtitle: "Start a quiet event room and let friends jump in.",
    startsAtLabel: "Sunday watch",
    botLabel: "Masters Bot",
    statusLabel: "Event",
    rooms: [],
  },
];

export function getFeaturedEventById(eventId: string) {
  return FEATURED_EVENTS.find((event) => event.id === eventId);
}
