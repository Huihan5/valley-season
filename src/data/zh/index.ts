/**
 * The Chinese half of the game's text. Shape is identical to its sibling: `en` is
 * declared as `Bundle`, so a key that goes missing in translation is a compile
 * error rather than a hole on screen.
 *
 * Generated shape, hand-maintained content — add a JSON file here and in the
 * sibling directory together.
 */
import actions from './actions.json';
import opening from './opening.json';
import systemLines from './system_lines.json';
import ui from './ui.json';
import dialogueFragments from './dialogue/fragments.json';
import dialogueGreetings from './dialogue/greetings.json';
import endingsEndings from './endings/endings.json';
import scenesActionResults from './scenes/action_results.json';
import scenesAmbient from './scenes/ambient.json';
import scenesLocations from './scenes/locations.json';
import scenesMarket from './scenes/market.json';
import scenesRumors from './scenes/rumors.json';
import scenesWeatherLines from './scenes/weather_lines.json';
import eventsDay1 from './events/day1.json';
import eventsDay10 from './events/day10.json';
import eventsDay11Echo from './events/day11_echo.json';
import eventsDay12 from './events/day12.json';
import eventsDay12Officer from './events/day12_officer.json';
import eventsDay13Echo from './events/day13_echo.json';
import eventsDay13Thierry from './events/day13_thierry.json';
import eventsDay15 from './events/day15.json';
import eventsDay15Record from './events/day15_record.json';
import eventsDay15Stumps from './events/day15_stumps.json';
import eventsDay18 from './events/day18.json';
import eventsDay18HuntArrival from './events/day18_hunt_arrival.json';
import eventsDay19HuntRide from './events/day19_hunt_ride.json';
import eventsDay20CampBanquet from './events/day20_camp_banquet.json';
import eventsDay20HuntOvernight from './events/day20_hunt_overnight.json';
import eventsDay20HuntStag from './events/day20_hunt_stag.json';
import eventsDay21CampHarvest from './events/day21_camp_harvest.json';
import eventsDay21HuntLorenz from './events/day21_hunt_lorenz.json';
import eventsDay21HuntMorning from './events/day21_hunt_morning.json';
import eventsDay22 from './events/day22.json';
import eventsDay23 from './events/day23.json';
import eventsDay27Officers from './events/day27_officers.json';
import eventsDay27StreetCorner from './events/day27_street_corner.json';
import eventsDay3 from './events/day3.json';
import eventsDay30Evening from './events/day30_evening.json';
import eventsDay30Millridge from './events/day30_millridge.json';
import eventsDay30Morning from './events/day30_morning.json';
import eventsDay4 from './events/day4.json';
import eventsDay6Timothy from './events/day6_timothy.json';
import eventsDay7DinnerArrival from './events/day7_dinner_arrival.json';
import eventsDay7DinnerDeparture from './events/day7_dinner_departure.json';
import eventsDay7DinnerHartmann from './events/day7_dinner_hartmann.json';
import eventsDay7DinnerReturn from './events/day7_dinner_return.json';
import eventsDay8Echo from './events/day8_echo.json';
import eventsOfficeFolio from './events/office_folio.json';
import eventsTimberRestraint from './events/timber_restraint.json';
import eventsRandomRandomForgeCityMerchant from './events/random/random_forge_city_merchant.json';
import eventsRandomRandomLostOx from './events/random/random_lost_ox.json';
import eventsRandomRandomQuietDay from './events/random/random_quiet_day.json';
import eventsRandomRandomToolPedlar from './events/random/random_tool_pedlar.json';
import eventsRandomRandomWell from './events/random/random_well.json';

const bundle = {
  actions: actions,
  opening: opening,
  systemLines: systemLines,
  ui: ui,
  dialogue: {
    fragments: dialogueFragments,
    greetings: dialogueGreetings,
  },
  endings: {
    endings: endingsEndings,
  },
  scenes: {
    actionResults: scenesActionResults,
    ambient: scenesAmbient,
    locations: scenesLocations,
    market: scenesMarket,
    rumors: scenesRumors,
    weatherLines: scenesWeatherLines,
  },
  events: {
    day1: eventsDay1,
    day10: eventsDay10,
    day11Echo: eventsDay11Echo,
    day12: eventsDay12,
    day12Officer: eventsDay12Officer,
    day13Echo: eventsDay13Echo,
    day13Thierry: eventsDay13Thierry,
    day15: eventsDay15,
    day15Record: eventsDay15Record,
    day15Stumps: eventsDay15Stumps,
    day18: eventsDay18,
    day18HuntArrival: eventsDay18HuntArrival,
    day19HuntRide: eventsDay19HuntRide,
    day20CampBanquet: eventsDay20CampBanquet,
    day20HuntOvernight: eventsDay20HuntOvernight,
    day20HuntStag: eventsDay20HuntStag,
    day21CampHarvest: eventsDay21CampHarvest,
    day21HuntLorenz: eventsDay21HuntLorenz,
    day21HuntMorning: eventsDay21HuntMorning,
    day22: eventsDay22,
    day23: eventsDay23,
    day27Officers: eventsDay27Officers,
    day27StreetCorner: eventsDay27StreetCorner,
    day3: eventsDay3,
    day30Evening: eventsDay30Evening,
    day30Millridge: eventsDay30Millridge,
    day30Morning: eventsDay30Morning,
    day4: eventsDay4,
    day6Timothy: eventsDay6Timothy,
    day7DinnerArrival: eventsDay7DinnerArrival,
    day7DinnerDeparture: eventsDay7DinnerDeparture,
    day7DinnerHartmann: eventsDay7DinnerHartmann,
    day7DinnerReturn: eventsDay7DinnerReturn,
    day8Echo: eventsDay8Echo,
    officeFolio: eventsOfficeFolio,
    timberRestraint: eventsTimberRestraint,
  },
  randomEvents: {
    forgeCityMerchant: eventsRandomRandomForgeCityMerchant,
    lostOx: eventsRandomRandomLostOx,
    quietDay: eventsRandomRandomQuietDay,
    toolPedlar: eventsRandomRandomToolPedlar,
    well: eventsRandomRandomWell,
  },
};

export type Bundle = typeof bundle;
export default bundle;
