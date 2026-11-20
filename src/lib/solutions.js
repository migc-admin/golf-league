// The three things Scorify is built for. Drives the homepage "Built for"
// router and the cross-links between the solution landing pages.
import { ONE_TIME } from './plans'

const fromPrice = name => ONE_TIME.find(o => o.name === name).price.replace('Starting at ', 'One-time from ')

export const SOLUTIONS = [
  {
    key: 'leagues',
    path: '/golf-league-software',
    title: 'Golf leagues',
    blurb: 'Weekly, monthly, or season-long. Flights, skins, Team Play, and standings that update after every event.',
    points: ['Money list or points standings', 'Flights and net scoring', 'Free for up to 16 players'],
    linkText: 'Golf league software',
  },
  {
    key: 'tournaments',
    path: '/golf-tournament-software',
    title: 'Tournaments and outings',
    blurb: 'Charity scrambles, member-guests, and club championships, from registration to awards.',
    points: ['Scramble, best ball, and stroke play', 'Shotgun starts and cart signs', fromPrice('Tournament')],
    linkText: 'Golf tournament software',
  },
  {
    key: 'trips',
    path: '/golf-trip-app',
    title: 'Golf trips',
    blurb: 'Buddies trips and Ryder Cup weekends: one trip page, costs split, every round scored.',
    points: ['Itinerary, lodging, and rooms', 'Standings across every round', fromPrice('Golf Trip')],
    linkText: 'Golf trip app',
  },
]
