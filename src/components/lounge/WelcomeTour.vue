<!--
  Welcome tour, shown once after the first sign-in: D's river tour in B's world. Scrolling
  rows the boat forward: the boat stays put and the river world slides past in depth layers
  (sky, far bank, far water, the near bank, near water). Stops: house note, "Those who rowed
  before you" (one landing per past year) with the 2023 lighthouse between them, this year's
  council (painted characters; tap one for a thought bubble with the real photo and note),
  three community islands, and the ghat, where the member gives the name the house will
  call them (with a live preview of their lantern / kite) and steps into the Lounge.
  Skip rows straight to the ghat card; it never skips the name.
  Cost at rest: the slow sky loops (stars by night, the sun's rays and its sparkles on the
  water by day) and the boat's idle bob, all transform/opacity and paused in a hidden tab.
  A scroll event schedules one frame that sets a few transforms and caption opacities.
  One-shot reveals are CSS transitions or single-run animations started once by a class.
  Motion spec: _notes/motion.md. Art grading: art/r6/tour-graded/build.py.
-->
<template>
  <div
    ref="rootEl"
    class="tour"
    :class="[mode, { leaving, still: reduceMotion, narrow: plan.narrow, skipping, lite }]"
    :style="{ height: `${plan.total}px` }"
  >
    <div class="t-stage" :inert="!!openC">
      <div ref="skyEl" class="t-sky" :style="{ height: px(plan.Hy + 4) }" aria-hidden="true">
        <picture v-if="LAYERS.sky">
          <source
            v-if="!plan.narrow"
            type="image/avif"
            :srcset="LAYERS.sky.set(mode, 'avif')"
            sizes="106vw"
          />
          <img
            :src="LAYERS.sky.src(mode)"
            :srcset="LAYERS.sky.set(mode, 'webp')"
            sizes="106vw"
            alt=""
          />
        </picture>
        <div v-if="mode === 'night'" class="t-stars">
          <i
            v-for="(s, i) in stars"
            :key="i"
            :style="{
              left: `${s.x}%`,
              top: `${s.y}%`,
              '--sz': `${s.s}px`,
              '--tw': `${s.d}s`,
              '--td': `${s.del}s`,
            }"
          ></i>
          <i ref="shootEl" class="t-shoot"></i>
        </div>
      </div>

      <!-- The sun (with its rays) by day, the moon by night: far away, so it does not slide. -->
      <div class="t-body" :class="mode" data-sky-body :style="plan.sun" aria-hidden="true">
        <template v-if="mode === 'day'">
          <span class="t-rays"></span>
          <img class="t-sunimg" :src="SUN" alt="" />
        </template>
        <img v-else class="t-moon" :src="MOON" alt="" />
      </div>

      <div ref="birdsEl" class="t-birds" aria-hidden="true"></div>

      <div
        ref="farWaterEl"
        class="t-tile t-farwater"
        :style="tileStyle('farwater', plan.Hy, plan.H - plan.Hy)"
        aria-hidden="true"
      >
        <span
          v-for="(_, i) in tileCount('farwater')"
          :key="i"
          class="t-span"
          :class="{ mirror: i % 2 }"
          :style="spanStyle('farwater', i)"
        ></span>
      </div>
      <!-- The sun's path on the water: a few glints that turn in and out, by day only. -->
      <div v-if="mode === 'day'" class="t-sparks" :style="plan.sparks" aria-hidden="true">
        <i
          v-for="(g, i) in SPARKS"
          :key="i"
          :style="{
            left: `${g.x}%`,
            top: `${g.y}%`,
            '--gd': `${g.d}s`,
            '--gl': `${g.l}s`,
            '--gs': g.s,
          }"
        ></i>
      </div>

      <div
        ref="treesEl"
        class="t-tile t-trees"
        :style="tileStyle('farbank', plan.Hy - plan.treeH + 2, plan.treeH)"
        aria-hidden="true"
      >
        <span
          v-for="(_, i) in tileCount('farbank')"
          :key="i"
          class="t-span"
          :class="{ mirror: i % 2 }"
          :style="spanStyle('farbank', i)"
        ></span>
      </div>
      <div ref="farEl" class="t-far" aria-hidden="true">
        <div class="t-item lighthouse" :class="{ lit }" :style="box(plan.light)">
          <img
            :src="graded(`lighthouse-dark-${mode}.webp`)"
            loading="lazy"
            decoding="async"
            alt=""
          />
          <span class="l-glow" :style="glowAt()"></span>
          <img
            class="l-lit"
            :src="graded(`lighthouse-lit-${mode}.webp`)"
            loading="lazy"
            decoding="async"
            alt=""
          />
        </div>
      </div>

      <div ref="worldEl" class="t-world">
        <template v-for="it in plan.items" :key="it.id">
          <img
            v-if="it.kind === 'bank'"
            class="t-item bank"
            :class="{ flip: it.flip }"
            :src="graded(`${it.src}-${mode}.webp`)"
            :style="box(it)"
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden="true"
          />

          <section
            v-else-if="it.kind === 'landing'"
            class="t-item landing"
            :aria-hidden="!visibleItem(it)"
            :inert="!visibleItem(it)"
            :style="box(it)"
            :aria-label="`${it.year}: ${it.people.map((p) => `${p.name}, ${p.role}`).join('; ')}`"
          >
            <img
              :src="graded(`landing-${it.v + 1}-${mode}.webp`)"
              loading="lazy"
              decoding="async"
              alt=""
            />
            <div class="lintel" :style="pct(it.art.lintel)" aria-hidden="true">
              <b>{{ it.year }}</b>
            </div>
            <div class="niches" :class="{ stack: plan.narrow }" :style="pct(it.niche)">
              <figure v-for="pp in it.people" :key="pp.name" class="niche">
                <!-- A plain frame: the house crest until a real photo is added. -->
                <span class="ph" :class="{ crest: !pp.photo }">
                  <img :src="pp.photo || CREST" loading="lazy" decoding="async" alt="" />
                </span>
                <figcaption class="plate">
                  <b>{{ pp.name }}</b>
                  <small>{{ pp.role }}</small>
                </figcaption>
              </figure>
            </div>
          </section>

          <!-- Characters and islands join the Tab order only while their chapter is on
               screen (tabindex), so keyboard users never land on something off stage. -->
          <div
            v-else-if="it.kind === 'lamp'"
            v-show="mode === 'night'"
            class="t-item c-lamp"
            :style="box(it)"
            aria-hidden="true"
          >
            <span class="i-lamp" :style="it.lamp">
              <span class="i-lamp-halo"></span>
              <span class="i-lamp-pool"></span>
              <span class="i-post"></span>
              <img :src="ISLAND_LAMP" alt="" decoding="async" />
            </span>
          </div>

          <div
            v-else-if="it.kind === 'council'"
            class="t-item council"
            :aria-hidden="activeCap !== 'council' || !visibleItem(it)"
            :inert="activeCap !== 'council' || !visibleItem(it)"
            :class="{ open: openP === it.v, hint: hint[it.v], met: met[it.v] }"
            :style="{ ...box(it), '--i': it.v }"
          >
            <button
              :ref="(el) => (whoEls[it.v] = el)"
              type="button"
              class="c-who"
              :tabindex="activeCap === 'council' && visibleItem(it) ? 0 : -1"
              :aria-expanded="openP === it.v"
              :aria-controls="`c-say-${it.v}`"
              @click="toggleP(it.v)"
            >
              <img
                class="c-char"
                :src="graded(`council-${it.pose}-${mode}.webp`)"
                loading="lazy"
                decoding="async"
                alt=""
              />
              <span
                v-if="mode === 'night' && it.lit"
                class="lamplit on-char"
                :style="{ background: it.lit, ...maskOf(graded(`council-${it.pose}-night.webp`)) }"
              ></span>
              <span class="c-label"
                ><b>{{ it.name }}</b
                ><small>{{ it.role }}</small></span
              >
            </button>
            <span class="c-nub" :style="it.nub" aria-hidden="true"><i></i><i></i><i></i></span>
            <div
              :id="`c-say-${it.v}`"
              class="c-say"
              :class="{ side: it.sideSay }"
              :style="it.say"
              role="group"
              :aria-label="`A note from ${it.name}`"
              :inert="openP !== it.v"
            >
              <span class="c-trail" aria-hidden="true"><i></i><i></i><i></i></span>
              <div class="c-cloud">
                <span class="puffs o" aria-hidden="true"><i v-for="n in 7" :key="n"></i></span>
                <span class="puffs f" aria-hidden="true"><i v-for="n in 7" :key="n"></i></span>
                <div class="c-in">
                  <img
                    class="c-photo"
                    :src="it.photo"
                    loading="lazy"
                    decoding="async"
                    :alt="`${it.name}, ${it.role}`"
                  />
                  <div class="c-text">
                    <b>{{ it.name }}</b>
                    <span class="role">{{ it.role }}</span>
                    <p>{{ it.note }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            v-else-if="it.kind === 'island'"
            type="button"
            class="t-item island"
            :aria-hidden="activeCap !== 'islands' || !visibleItem(it)"
            :inert="activeCap !== 'islands' || !visibleItem(it)"
            :class="{ open: openId === it.c.id, glint: glint[it.v] }"
            :style="{ ...box(it), '--i': it.v }"
            :aria-label="`${it.c.name} community`"
            :tabindex="activeCap === 'islands' && visibleItem(it) ? 0 : -1"
            @click="openIsland(it.c)"
          >
            <span class="i-shade"></span>
            <span class="i-glow" :style="it.glow"></span>
            <img
              class="fig"
              :src="graded(`fig-${it.c.id}-${mode}.webp`)"
              :style="it.fig"
              loading="lazy"
              decoding="async"
              alt=""
            />
            <img
              class="land"
              :src="graded(`island-${it.v + 1}-${mode}.webp`)"
              loading="lazy"
              decoding="async"
              alt=""
            />
            <!-- Night: the lamp's light on the figures and on the island's mud. -->
            <template v-if="mode === 'night'">
              <span
                class="lamplit on-fig"
                :style="{ ...it.figLit, ...maskOf(graded(`fig-${it.c.id}-night.webp`)) }"
              ></span>
              <span
                class="lamplit on-land"
                :style="{
                  background: it.landLit,
                  ...maskOf(graded(`island-${it.v + 1}-night.webp`)),
                }"
              ></span>
            </template>
            <!-- Night: a hurricane lamp on a bamboo post, or hung from the island's tree. -->
            <span
              v-if="mode === 'night'"
              class="i-lamp"
              :class="{ hung: it.lampHung }"
              :style="it.lamp"
              aria-hidden="true"
            >
              <span class="i-lamp-halo"></span>
              <span class="i-post"></span>
              <span class="i-arm"></span>
              <img :src="ISLAND_LAMP" alt="" decoding="async" />
              <span class="i-lamp-refl"><i></i><i></i><i></i></span>
            </span>
            <span class="i-spark" :style="it.spark" aria-hidden="true"></span>
            <span class="i-label" :style="it.label">{{ it.c.name }}</span>
          </button>

          <div v-else-if="it.kind === 'ghat'" class="t-item ghat" :style="box(it)">
            <img :src="graded(`ghat-${mode}.webp`)" loading="lazy" decoding="async" alt="" />
            <!-- Night: the two diyas on the gate's pillars glow and light the stone near them. -->
            <template v-if="mode === 'night'">
              <span
                class="lamplit on-ghat"
                :style="maskOf(graded('ghat-night.webp'))"
                aria-hidden="true"
              ></span>
              <span class="diya" style="left: 22.6%" aria-hidden="true"></span>
              <span class="diya" style="left: 77.1%" aria-hidden="true"></span>
            </template>
            <div ref="gateEl" class="gate" :style="pct(GATE)">
              <span
                :ref="(el) => (gateName = el)"
                :class="{ named: saved && !!savedName }"
                :style="{ '--len': gateText.length }"
                >{{ gateText }}</span
              >
            </div>
          </div>

          <img
            v-else-if="it.kind === 'branch'"
            :ref="(el) => (branchEls[it.i] = el)"
            class="t-item branch"
            :style="{ ...box(it), '--dir': it.dir }"
            :src="graded(`branch-${mode}.webp`)"
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden="true"
          />
        </template>
      </div>

      <!-- The boat (home/RiverBoat.vue, shared with Home and Events): fixed in screen space
           while the world slides. JS sets the scroll bob on this wrapper; RiverBoat's idle bob,
           the boatman's lamp (lit already: it was lit before you arrived) and its reflection
           live inside. -->
      <div ref="boatEl" class="t-boat" :style="plan.boat" aria-hidden="true">
        <RiverBoat :catch-lamp="false" />
      </div>
      <div
        ref="waterEl"
        class="t-tile t-water"
        :style="tileStyle('nearwater', plan.H - plan.waterH, plan.waterH)"
        aria-hidden="true"
      >
        <span
          v-for="(_, i) in tileCount('nearwater')"
          :key="i"
          class="t-span"
          :class="{ mirror: i % 2 }"
          :style="spanStyle('nearwater', i)"
        ></span>
      </div>
      <header class="t-top">
        <span class="t-brand t-pill"
          ><img :src="CREST" alt="" width="30" height="30" /><span class="t-brand-name"
            >Sundarbans House</span
          ></span
        >
        <span v-if="!docked" class="t-acts">
          <button
            type="button"
            class="t-auto t-pill"
            :class="{ on: auto }"
            :aria-pressed="auto ? 'true' : 'false'"
            @click="toggleAuto"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path v-if="auto" d="M4.5 3v10M11.5 3v10" />
              <path v-else d="M5 3.2v9.6L12.6 8z" />
            </svg>
            {{ auto ? 'Pause' : 'Row for me' }}
          </button>
          <button type="button" class="skip t-pill" @click="skip">Skip tour</button>
        </span>
      </header>

      <!-- Chapter cards are ghat paper with the lotus band on both edges (cards.css). -->
      <section ref="noteEl" class="t-note gp gp-band" aria-label="About the house">
        <p class="n-title">
          <img :src="CREST" alt="Sundarbans House crest" width="44" height="44" />
          <span>{{ HOUSE_NOTE.title }}</span>
        </p>
        <p class="n-body">{{ HOUSE_NOTE.body }}</p>
        <p class="n-pride">{{ HOUSE_NOTE.pride }}</p>
      </section>

      <div
        v-for="(c, i) in CAPTIONS"
        :key="c.id"
        :ref="(el) => (capEls[i] = el)"
        class="t-cap gp gp-band"
        :class="[c.id, { away: c.id === 'council' && openP >= 0 }]"
        :aria-hidden="c.id !== activeCap"
      >
        <p class="gp-kicker">{{ c.kicker }}</p>
        <h2 v-if="c.title">{{ c.title }}</h2>
        <p v-if="c.sub" class="sub">{{ c.sub }}</p>
        <p v-if="c.by" class="by">{{ c.by }}</p>
      </div>

      <p ref="cueEl" class="t-cue" :class="{ gone: auto }">
        Scroll to row <span aria-hidden="true">↓</span>
      </p>

      <section
        ref="cardEl"
        class="t-card gp gp-band"
        :class="{ in: docked, out: entering }"
        :aria-hidden="!docked"
        :inert="!docked"
        aria-labelledby="t-card-h"
        tabindex="-1"
      >
        <!-- The body scrolls, not the card, so the lotus bands stay on the card's edges. -->
        <div ref="cardBodyEl" class="t-card-body">
          <div class="f-top">
            <div>
              <p class="gp-kicker">The ghat</p>
              <h2 id="t-card-h">{{ cardTitle }}</h2>
            </div>
            <!-- Live preview: exactly what your lantern (night) or kite (day) will say. -->
            <div v-if="!saved" class="f-preview" aria-hidden="true" inert>
              <NameBeacon :name="nameDraft" :cta="false" :halo="false" :tappable="false" />
            </div>
          </div>
          <form v-if="!saved" class="who" @submit.prevent="save">
            <label class="f-name">
              <span>Your full name</span>
              <input
                ref="nameEl"
                v-model="nameDraft"
                type="text"
                autocomplete="name"
                maxlength="100"
                placeholder="As on your IITM records"
                aria-describedby="t-name-help"
              />
              <small id="t-name-help"
                >It goes on your {{ objectWord }}. Please use your registered name;
                <span class="t-name-policy"
                  >another name may lead to disciplinary action.</span
                ></small
              >
            </label>
            <label class="f-name">
              <span>Phone <small>optional</small></span>
              <input
                v-model="phoneDraft"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                maxlength="20"
                placeholder="For later forms"
              />
            </label>
            <div class="f-fixed gp-inset">
              <div>
                <span class="f-k">Roll</span>
                <span class="f-v">{{ member.roll }}</span>
              </div>
              <div>
                <span class="f-k">Region</span>
                <span class="f-v">{{ member.region.name }}</span>
              </div>
              <p class="f-wrong">
                <template v-if="!member.region_id">
                  Choose your region from Edit profile after entering. It saves immediately.
                </template>
                <template v-else>
                  Wrong? Ask {{ member.coordinator.name }} to correct your region. Region changes
                  need coordinator approval.
                </template>
              </p>
            </div>
            <p class="f-cert">
              {{
                certName
                  ? `Certificates print ${certName}. Lounge name edits do not change that.`
                  : 'A certificate name is asked only when an event releases one for you.'
              }}
            </p>
            <p v-if="saveError" class="ff-err" role="alert">{{ saveError }}</p>
            <div class="f-acts">
              <button type="submit" class="gp-btn is-big" :disabled="!canSave || saving">
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="gp-btn is-ghost is-big" @click="notNow">Not now</button>
            </div>
          </form>
          <div v-else class="who done">
            <p class="f-sum">
              <span>{{ savedName }} · {{ member.roll }} · {{ member.region.name }}</span>
              <button type="button" class="edit" @click="saved = false">Edit</button>
            </p>
            <p class="f-help">Your groups, live sessions and house news are inside.</p>
            <button
              ref="enterEl"
              type="button"
              class="gp-btn is-big is-block"
              :aria-busy="entering"
              @click="enter"
            >
              Enter the Lounge
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="openC" class="sheet-wrap" @click.self="closeIsland">
      <aside
        ref="sheetEl"
        class="sheet gp gp-band-top"
        role="dialog"
        aria-modal="true"
        :aria-label="`${openC.name} community`"
      >
        <button ref="closeEl" type="button" class="x" aria-label="Close" @click="closeIsland">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <img class="s-fig" :src="graded(`fig-${openC.id}-${mode}.webp`)" alt="" />
        <p class="gp-kicker">Community</p>
        <h3>{{ openC.name }}</h3>
        <p class="s-about">{{ openC.about }}</p>
        <h4>Recent events</h4>
        <ul class="gp-rows">
          <li v-for="e in openC.events" :key="e.title">
            <b>{{ e.title }}</b>
            <span>{{ e.type }} · {{ e.date }}</span>
          </li>
        </ul>
        <p class="s-join">Its WhatsApp group is waiting in your Lounge.</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import CREST from '../../assets/crest.webp';
import M from './art/r4/manifest.json';
import M5 from './art/r5/manifest.json';
import NameBeacon from './home/NameBeacon.vue';
import RiverBoat from './home/RiverBoat.vue';
import { BIRDS, BOAT, MOON, PLATE, SUN } from './home/art.js';
import {
  animate,
  lite,
  rare,
  reduced,
  motionActive,
  onMotionChange,
  motionFrame,
  motionNow,
} from './home/motion.js';
import { member } from './fixtures.js';
import { play } from './sound.js';
import { errorText } from '../../lib/auth.js';
import { certName, mode, preferredName, savePreferredName, wait } from './state.js';
import {
  COMMUNITIES,
  COUNCIL,
  COUNCIL_YEAR,
  FOUNDED,
  HOUSE_NOTE,
  LANDINGS,
  MILESTONE,
} from './tour-data.js';

const props = defineProps({ leaving: Boolean });
const emit = defineEmits(['done', 'gone']);

/* ---------- Art ---------- */

/* Landmarks: D's art regraded into B's palette (art/r6/tour-graded/build.py). Boxes are % of
   each image, measured when the art was keyed (art/r4 and r5 manifests: same geometry). */
const tourArt = import.meta.glob('./art/r6/tour-graded/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const graded = (name) => tourArt[`./art/r6/tour-graded/${name}`];
const layers = import.meta.glob('./art/r6/tour-sky*.{webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const layer = (name) => layers[`./art/r6/${name}`];
const petals = import.meta.glob('./art/r3/petal-*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const riverArt = import.meta.glob('./home/art/plate-*.{webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const LAYERS = {
  sky: {
    src: (md) => layer(`tour-sky-${md}.webp`),
    set: (md, ext) =>
      ext === 'avif'
        ? `${layer(`tour-sky-${md}.avif`)} 1536w`
        : `${layer(`tour-sky-${md}-800.webp`)} 800w, ${layer(`tour-sky-${md}.webp`)} 1536w`,
  },
  farbank: { src: PLATE.src, ratio: 1.5, plate: true },
  // The same painted river as Home. Crop its water, keeping the sky out of these bands.
  farwater: {
    src: PLATE.src,
    plate: true,
    ratio: 1.5,
    crop: PLATE.horizon,
    zoom: 1 / (1 - PLATE.horizon),
  },
  nearwater: { src: PLATE.src, plate: true, ratio: 1.5, crop: 0.91, zoom: 1 / 0.09 },
};

const GATE = { x: 30.08, y: 11.92, w: 39.84, h: 6.8, ar: 1536 / 1015 };
const FIG_AR = 560 / 354;
/* The boatman's lamp (art/r6/island-lamp, cut by _art/r9-island-lamp.py), one per island by
   night, spread so no two sit together: on a bamboo post at the island's open end (x, y: the
   post's foot, % of the island art; s: the arm's side, -1 left) or, on Technical, hung from
   its mangrove's lowest left branch (hung: x, y is the branch). */
const ISLAND_LAMP = new URL('./art/r6/island-lamp.webp', import.meta.url).href;
const LAMP_SPOTS = [
  { x: 12, y: 49, s: -1 },
  { x: 6, y: 25, s: 0, hung: true },
  { x: 13, y: 51, s: -1 },
];
/* The painted waterline, % down the island art. */
const WATERLINE = 71;
/* The lamp's flame, in lamp widths below its top. */
const LAMP_FLAME = 1.2;
/* How far an island's lamp lights its figures, x the island's width. */
const ISLAND_REACH = 0.62;
/* The council's lamps, x the characters' height: lamp width, post height, the lamp's distance
   beside a lone character, and the least reach of its light. */
const CLAMP = { lw: 0.085, post: 0.74, beside: 0.5, reach: 0.9 };

/* Lamplight on painted art: a warm pool centred on each flame (x, y in px from the layer's
   top-left, r its reach), drawn in a .lamplit layer that tour.css masks to the art's own pixels
   and blends onto it, so only the figures and mud catch the light. */
function lampLight(lights) {
  return lights
    .map(
      ({ x, y, r }) =>
        `radial-gradient(circle ${px(r)} at ${px(x)} ${px(y)}, rgb(255 214 150), ` +
        `rgb(255 172 84 / 0.6) 22%, rgb(255 150 64 / 0.22) 55%, transparent)`
    )
    .join(', ');
}
const maskOf = (src) => ({ '--art': `url("${src}")` });

const CAPTIONS = [
  {
    id: 'landings',
    kicker: `Since ${FOUNDED}`,
    title: 'Those who rowed before you',
    sub: "Each year's Secretary and Deputy Secretary.",
  },
  { id: 'milestone', kicker: `${MILESTONE.year}`, sub: MILESTONE.text, by: MILESTONE.by },
  {
    id: 'council',
    kicker: `Upper House Council, ${COUNCIL_YEAR}`,
    title: 'Your council this year',
  },
  { id: 'islands', kicker: 'Communities', title: 'Find your people.' },
];

const words = (...s) => s.join(' ').split(/\s+/).filter(Boolean).length;
/* Row for me reads at about 250 words a minute: dwell = clamp(1.5s + words / 4.2, 2.2s, 7s). */
const dwellFor = (n) => clamp(1.5 + n / 4.2, 2.2, 7);

/* Sun glints on the water: x/y % of the sparkle box, delay, loop length (each its own, so
   they never sync), size. */
const SPARKS = [
  { x: 48, y: 10, d: -0.4, l: 3.6, s: 1 },
  { x: 30, y: 34, d: -2.1, l: 4.1, s: 0.8 },
  { x: 66, y: 42, d: -1.2, l: 4.5, s: 0.9 },
  { x: 44, y: 70, d: -3.3, l: 4.8, s: 0.75 },
  { x: 58, y: 92, d: -0.9, l: 5.0, s: 0.65 },
];

const rootEl = ref(null);
const skyEl = ref(null);
const farWaterEl = ref(null);
const farEl = ref(null);
const treesEl = ref(null);
const worldEl = ref(null);
const boatEl = ref(null);
const waterEl = ref(null);
const noteEl = ref(null);
const cueEl = ref(null);
const cardEl = ref(null);
const cardBodyEl = ref(null);
const nameEl = ref(null);
const enterEl = ref(null);
const sheetEl = ref(null);
const closeEl = ref(null);
const shootEl = ref(null);
const birdsEl = ref(null);
const visibleItems = shallowRef(new Set());
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = ref(reduced());
const animations = new Set();
let gateName = null;
const capEls = [];
const branchEls = [];
const whoEls = [];

const plan = shallowRef(makePlan(window.innerWidth, window.innerHeight));
const openId = ref(null);
const openC = computed(() => COMMUNITIES.find((c) => c.id === openId.value) || null);
const activeCap = ref('');
const lit = ref(false);
const docked = ref(false);
const entering = ref(false);
const skipping = ref(false);
/* Council: which character's thought bubble is open (-1: none), which have shown their
   one-time "…" hint, and which the member has already opened. Islands: one glint each. */
const openP = ref(-1);
const hint = ref(COUNCIL.map(() => false));
const met = ref(COUNCIL.map(() => false));
const glint = ref(COMMUNITIES.map(() => false));

/* Stars across the whole night sky (fixed, so the sky is the same on every visit). Each
   twinkles on its own period; phones and low-end devices get fewer. */
const stars = computed(() => {
  const n = lite ? 14 : plan.value.narrow ? 26 : 44;
  return Array.from({ length: n }, (_, i) => ({
    x: (i * 37.3 + 11) % 100,
    y: 3 + ((i * 53.7) % 80),
    s: 1.5 + (i % 3) * 0.5,
    d: (3.2 + ((i * 1.37) % 4.4)).toFixed(2),
    del: -((i * 0.61) % 5).toFixed(2),
  }));
});

/* The name at the ghat: the member's full name, never the roll number. */
const nameDraft = ref(preferredName.value || member.full_name || '');
const phoneDraft = ref(member.phone || '');
const saved = ref(false);
const savedName = ref('');
const saving = ref(false);
const saveError = ref('');
const clean = (v) => v.trim().replace(/\s+/g, ' ');
const savedFirst = computed(() => savedName.value.split(' ')[0]);
const canSave = computed(() => clean(nameDraft.value).length > 0);
const objectWord = computed(() => (mode.value === 'night' ? 'lantern' : 'kite'));
const cardTitle = computed(() =>
  saved.value && savedFirst.value
    ? `Welcome aboard, ${savedFirst.value}.`
    : `Name your ${objectWord.value}`
);
const gateText = computed(() =>
  saved.value && savedName.value ? savedName.value : 'Welcome aboard'
);
let ticking = false;
let lastW = window.innerWidth;
let lastH = window.innerHeight;
let resizeT = 0;
let dead = false;
let lastFocus = null;
let locked = false;
let lockedAt = 0;
let stopShoot = null;
let stopBirds = null;
let closingIsland = false;
const opened = new Set();

function px(v) {
  return `${Math.round(v * 10) / 10}px`;
}
function box(it) {
  return { left: px(it.x - it.w / 2), top: px(it.base - it.h), width: px(it.w), height: px(it.h) };
}
function pct(p) {
  return { left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` };
}
function band(name) {
  const p = plan.value;
  if (name === 'farbank') return { top: p.Hy - p.treeH + 2, h: p.treeH };
  if (name === 'farwater') return { top: p.Hy, h: p.H - p.Hy };
  return { top: p.H - p.waterH, h: p.waterH };
}
function tileW(name, h) {
  const L = LAYERS[name];
  return L.ratio * paintedHeight(name, h);
}
function paintedHeight(name, h) {
  if (name === 'farbank') return (plan.value.H - plan.value.Hy) / (1 - PLATE.horizon);
  return h * (LAYERS[name].zoom || 1);
}
function tileCount(name) {
  return Math.ceil(plan.value.W / tileW(name, band(name).h)) + 3;
}
function tileStyle(name, top, h) {
  return { top: px(top), height: px(h), width: px(tileW(name, h) * tileCount(name)) };
}
function spanStyle(name, i) {
  const L = LAYERS[name];
  const h = band(name).h;
  const w = tileW(name, h);
  const paintedH = paintedHeight(name, h);
  const crop = name === 'farbank' ? PLATE.horizon - h / paintedH : L.crop || 0;
  return {
    left: px(i * w),
    width: px(w + 0.5),
    height: px(h),
    backgroundImage: L.plate ? riverImage() : `url(${L.src(mode.value)})`,
    backgroundSize: `${px(w)} ${px(paintedH)}`,
    backgroundPosition: `0 ${px(-paintedH * crop)}`,
  };
}
function riverImage() {
  const size = plan.value.narrow ? 900 : 1536;
  const path = `./home/art/plate-${mode.value}-${size}`;
  return `image-set(url("${riverArt[`${path}.avif`]}") type("image/avif"), url("${riverArt[`${path}.webp`]}") type("image/webp"))`;
}
function visibleItem(it) {
  return visibleItems.value.has(it.id);
}
function syncVisible(p, offset) {
  const next = new Set(
    p.items
      .filter(
        (it) =>
          ['landing', 'council', 'island'].includes(it.kind) &&
          it.x - offset > 0 &&
          it.x - offset < p.W
      )
      .map((it) => it.id)
  );
  const before = visibleItems.value;
  if (before.size !== next.size || [...next].some((id) => !before.has(id)))
    visibleItems.value = next;
}
function tourAnimate(el, frames, options) {
  const animation = animate(el, frames, options);
  animations.add(animation);
  const forget = () => animations.delete(animation);
  animation.finished.then(forget, forget);
  return animation;
}

function glowAt() {
  const l = M.lighthouse.lamp;
  return { left: `${l.x}%`, top: `${l.y}%` };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}

/* ---------- Layout: where everything sits on the river, and the scroll script ---------- */

function makePlan(W, H) {
  const narrow = W < 760;
  /* Council and islands get one stop each (phone style) when three side by side would
     not fit, e.g. a portrait tablet. */
  const soloC = narrow || W < 1180;
  const soloI = narrow || W < 980;
  const items = [];
  const segs = [];
  const ch = {};
  let s = 0;
  let off = 0;
  /* `dwell`: seconds Row for me spends on a hold; `act`: what it does there. */
  const hold = (len, dwell = 2.5, act = null) => {
    segs.push({ s0: s, s1: s + len, x0: off, x1: off, ease: false, dwell, act });
    s += len;
  };
  const travel = (to, rate = 1) => {
    const len = Math.max(1, Math.abs(to - off) * rate);
    segs.push({ s0: s, s1: s + len, x0: off, x1: to, ease: true });
    s += len;
    off = to;
  };
  /* Go to world x so it sits at screen x `at`, then hold. */
  const stop = (x, at, rate, len, dwell, act) => {
    const start = s;
    travel(x - at, rate);
    const arrive = s;
    hold(len, dwell, act);
    return { start, arrive, leave: s };
  };

  /* Depth: the horizon, how fast each far layer slides, and the near bank's waterline. */
  const Hy = Math.round(H * (narrow ? 0.47 : 0.55));
  const treeH = Math.round(H * (narrow ? 0.075 : 0.14));
  const waterH = Math.round(H * (narrow ? 0.06 : 0.075));
  const far = narrow ? 0.1 : 0.2;
  const base = H * (narrow ? 0.86 : 0.93);

  /* 0. House note: the boat sits still while it reads. */
  hold(H * 0.55, dwellFor(words(HOUSE_NOTE.title, HOUSE_NOTE.body, HOUSE_NOTE.pride)));
  ch.note = { start: 0, arrive: 0, leave: s };

  /* 1. Those who rowed before you: one landing per past year, built into one continuous
     bank. On a phone each landing is shown big enough that its niche opening spans the
     screen. */
  const L = M.landing;
  const openW = L.reduce((a, l) => a + l.open.w, 0) / L.length / 100;
  const buildW = Math.max(...L.map((l) => l.build.w)) / 100;
  const LW = narrow ? (W * 0.92) / openW : clamp(H * 1.25, 760, 1120);
  const at = narrow ? W * 0.5 : W * 0.62;
  const LSp = narrow ? Math.max(LW * buildW * 0.5 + W * 0.62, W * 1.1) : LW * (buildW + 0.07);
  const gap = narrow ? W * 1.15 : W * 0.5;
  const after = LANDINGS.findIndex((l) => l.year === MILESTONE.after);
  const L0 = at + W * (narrow ? 1.3 : 0.95);
  const lx = LANDINGS.map((_, i) => L0 + i * LSp + (i > after ? gap : 0));
  /* Every landing and bank image shares one scale: 1280 art px = LW screen px. */
  const u = LW / 1280;
  const bankH = M.bank.h * u;
  const landings = [];
  const LX = narrow ? W * 0.5 : W * 0.7;
  const capWords = (id) => {
    const c = CAPTIONS.find((x) => x.id === id);
    return words(c.kicker, c.title || '', c.sub || '', c.by || '');
  };
  let mile = null;
  LANDINGS.forEach((l, i) => {
    const art = L[i % L.length];
    const h = (LW * art.h) / art.w;
    /* Niches: the opening, plus a little of the floor in front of it. */
    const o = art.open;
    const ext = narrow ? 0.34 : 0.14;
    const niche = { x: o.x + o.w * 0.02, y: o.y + o.h * 0.04, w: o.w * 0.96, h: o.h * (1 + ext) };
    /* Phone: openings differ in width, so centre each niche on its landing (the landing is
       centred on screen at rest) and keep 32px clear on both sides for portrait and plate. */
    if (narrow) {
      niche.w = Math.min(niche.w, ((W - 64) / LW) * 100);
      niche.x = 50 - niche.w / 2;
    }
    items.push({
      id: `l${l.year}`,
      kind: 'landing',
      v: i % L.length,
      art,
      niche,
      x: lx[i],
      base,
      w: LW,
      h,
      year: l.year,
      people: l.people,
    });
    /* Count only what is new to read: the roles repeat after the first landing. */
    const n = words(String(l.year), ...l.people.map((p) => (i ? p.name : `${p.name} ${p.role}`)));
    landings.push(
      stop(lx[i], at, 0.7, H * 0.3, dwellFor(n + (i === 0 ? capWords('landings') : 0)))
    );
    if (i === after) {
      /* The lighthouse moment: hold on the open bank between this landing and the next. */
      mile = stop((lx[i] + lx[i + 1]) / 2, LX, 0.7, H * 0.45, dwellFor(capWords('milestone')));
    }
  });
  ch.landings = {
    start: landings[0].start,
    arrive: landings[0].arrive,
    leave: landings.at(-1).leave,
  };
  ch.milestone = mile;
  const offL = (lx[after] + lx[after + 1]) / 2 - LX;

  /* The lighthouse stands on the far bank and slides at the far layer's speed. */
  const lhH = narrow ? H * 0.22 : Math.min(H * 0.38, W * 0.42);
  const lhW = (lhH * M.lighthouse.w) / M.lighthouse.h;
  const light = { x: LX + offL * far, base: Hy + lhH * M.lighthouse.foot, w: lhW, h: lhH };

  /* 2. This year's council: three painted characters standing on the same bank, a name
     plate under each. Tapping one opens a thought bubble above it (photo, name, note).
     Side by side on wide screens; one per screen on narrower ones. */
  const C5 = M5.council;
  const chH = narrow ? clamp(H * 0.27, 180, 250) : clamp(H * 0.36, Math.min(230, H * 0.42), 330);
  const cSp = soloC ? W * 1.1 : clamp(W * 0.24, 290, 360);
  const cX0 = lx.at(-1) + (narrow ? W * 1.2 : soloC ? LW * 0.5 + W * 0.62 : LW * 0.5 + W * 0.36);
  const bankTop = base - bankH * (1 - M.bank.top);
  const cBase = bankTop + bankH * 0.035;
  /* Bubble width; its side puffs reach about 14px further out. On a short screen (a phone
     held sideways) there is no room above the head, so the bubble opens beside it. */
  const sayW = Math.min(W - 52, narrow ? 360 : 340);
  const sideSay = cBase - chH - 44 - 190 < 56;
  /* Night: hurricane lamps on bamboo posts in the bank, one between each pair of characters,
     or beside each one when they stand a screen apart. Each lights the side of the
     characters that faces it (CLAMP: lamp width, post height and reach, x chH). */
  const cLw = chH * CLAMP.lw;
  const cPost = chH * CLAMP.post;
  const cFlame = cBase - cPost + 1 + cLw * LAMP_FLAME;
  const cLampX = soloC
    ? COUNCIL.map((_, i) => cX0 + i * cSp - chH * CLAMP.beside)
    : COUNCIL.slice(1).map((_, i) => cX0 + (i + 0.5) * cSp);
  const cReach = soloC ? chH * CLAMP.reach * 0.8 : Math.max(cSp * 0.7, chH * CLAMP.reach);
  cLampX.forEach((x, i) => {
    items.push({
      id: `cl${i}`,
      kind: 'lamp',
      x,
      base: cBase,
      w: 0,
      h: 0,
      lamp: { '--lw': px(cLw), '--s': 0, '--post': px(cPost) },
    });
  });
  COUNCIL.forEach((c, i) => {
    const a = C5[c.pose];
    const head = a.head;
    const w = (chH * a.w) / a.h;
    const left = cX0 + i * cSp - w / 2;
    const lit = lampLight(
      cLampX
        .filter((x) => Math.abs(x - (left + w / 2)) < cReach)
        .map((x) => ({ x: x - left, y: cFlame - (cBase - chH), r: cReach }))
    );
    /* Centre the bubble over the head, but keep it on screen when a character stands
       alone in the middle of a narrow screen; the trail still ends at the head. */
    const hx = (w * head.x) / 100;
    const room = soloC ? Math.max(0, (W - sayW) / 2 - 22) : Infinity;
    const sx = clamp(hx, w / 2 - room, w / 2 + room);
    items.push({
      id: `c${i}`,
      kind: 'council',
      v: i,
      x: cX0 + i * cSp,
      base: cBase,
      w,
      h: chH,
      lit,
      /* The hint nub sits just off the head; the bubble is centred over the head. */
      nub: { left: `${head.x + 12}%`, top: `${head.y - 3}%` },
      sideSay,
      say: sideSay
        ? { left: `calc(100% + 40px)`, top: px(Math.max(0, 60 - (cBase - chH))), width: px(sayW) }
        : {
            left: px(sx),
            bottom: `calc(${100 - head.y}% + 44px)`,
            width: px(sayW),
            '--tx': px(hx - sx),
          },
      ...c,
    });
  });
  /* The name and role are already on the plate under each character. */
  const noteWords = COUNCIL.map((c) => words(c.note));
  let cArr;
  if (soloC) {
    const cs = COUNCIL.map((_, i) =>
      stop(cX0 + i * cSp, W * 0.5, 1.6, H * 0.45, dwellFor(noteWords[i]), { council: [i] })
    );
    ch.council = {
      start: cs[0].start,
      arrive: cs[0].arrive,
      leave: cs.at(-1).leave,
      each: cs.map((c) => c.arrive),
    };
    cArr = ch.council.each;
  } else {
    const d = noteWords.reduce((a, n) => a + dwellFor(n), 0);
    ch.council = stop(cX0 + cSp, W * 0.55, 2, H * 0.7, d, {
      council: COUNCIL.map((_, i) => i),
    });
    cArr = COUNCIL.map(() => ch.council.arrive);
  }

  /* The bank: mirrored tiles from before the first landing to past the council, with a
     tapered end at each side. */
  const bStart = lx[0] - LW * 1.2;
  const bEnd = cX0 + cSp * (COUNCIL.length - 1) + (soloC ? W * 0.55 : W * 0.4);
  const bank = [];
  const bw = M.bank.w * u;
  const endW = M.bankEnd.w * u;
  const endH = M.bankEnd.h * u;
  bank.push({
    id: 'b-start',
    kind: 'bank',
    src: 'bank-end',
    flip: true,
    x: bStart + endW / 2,
    base,
    w: endW,
    h: endH,
  });
  let bx = bStart + endW - 1;
  let k = 0;
  while (bx < bEnd) {
    bank.push({
      id: `b${k}`,
      kind: 'bank',
      src: 'bank',
      flip: false,
      x: bx + bw / 2,
      base,
      w: bw,
      h: bankH,
    });
    bx += bw - 1;
    k++;
  }
  bank.push({
    id: 'b-end',
    kind: 'bank',
    src: 'bank-end',
    flip: false,
    x: bx + endW / 2,
    base,
    w: endW,
    h: endH,
  });
  items.unshift(...bank);
  const bankStop = bx + endW;

  /* 3. Community islands, out in open water past the end of the bank. */
  const iA = M.island[0];
  const iW = narrow ? W * 0.86 : soloI ? Math.min(W * 0.62, 520) : clamp(W * 0.28, 300, 420);
  const iSp = soloI ? W * 1.1 : iW;
  const iX0 = bankStop + (narrow ? W * 0.75 : W * 0.55);
  const iBase = H * (narrow ? 0.82 : 0.78);
  COMMUNITIES.forEach((c, i) => {
    const art = M.island[i] || iA;
    /* The painted islands are low; a little extra height gives the mud some bulk. */
    const h = ((iW * art.h) / art.w) * 1.22;
    const crest = art.crest;
    const figW = iW * (narrow ? 0.74 : 0.66);
    const figH = figW / FIG_AR;
    const crestY = h * (crest.y / 100);
    const cx = ((crest.x0 + crest.x1) / 2) * 0.01 * iW;
    const fig = { left: px(cx - figW / 2), top: px(crestY - figH * 0.93), width: px(figW) };
    const glow = {
      left: px(cx - figW * 0.62),
      top: px(crestY - figH * 1.05),
      width: px(figW * 1.24),
      height: px(figH * 1.15),
    };
    const label = { left: px(cx), top: px(crestY - figH * 0.93 - 40) };
    const spark = { left: px(cx + figW * 0.36), top: px(crestY - figH * 0.86) };
    const ls = LAMP_SPOTS[i] || LAMP_SPOTS[0];
    const lw = iW * 0.058;
    const lamp = {
      left: px((iW * ls.x) / 100),
      top: px((h * ls.y) / 100),
      '--lw': px(lw),
      '--s': ls.s,
      '--drop': px((h * (WATERLINE - ls.y)) / 100),
    };
    /* The flame, in the island's box (the post, arm and wire geometry of .i-lamp). */
    const fx = (iW * ls.x) / 100 + (ls.hung ? 0 : ls.s * lw * 1.3);
    const fy = (h * ls.y) / 100 + (ls.hung ? lw * 0.35 : 1 - lw * 4.2) + lw * LAMP_FLAME;
    const figL = cx - figW / 2;
    const figT = crestY - figH * 0.93;
    const figLit = {
      ...fig,
      height: px(figH),
      background: lampLight([{ x: fx - figL, y: fy - figT, r: iW * ISLAND_REACH }]),
    };
    const landLit = lampLight([{ x: fx, y: fy, r: iW * ISLAND_REACH * 0.8 }]);
    items.push({
      id: `i${c.id}`,
      kind: 'island',
      v: i,
      c,
      x: iX0 + i * iSp,
      base: iBase,
      w: iW,
      h,
      fig,
      glow,
      label,
      spark,
      lamp,
      lampHung: !!ls.hung,
      figLit,
      landLit,
    });
  });
  if (soloI) {
    const is = COMMUNITIES.map((c, i) =>
      stop(
        iX0 + i * iSp,
        W * 0.5,
        1.2,
        H * 0.42,
        dwellFor(words(c.name) + (i ? 0 : capWords('islands')))
      )
    );
    ch.islands = {
      start: is[0].start,
      arrive: is[0].arrive,
      leave: is.at(-1).leave,
      each: is.map((c) => c.arrive),
    };
  } else {
    const n = capWords('islands') + words(...COMMUNITIES.map((c) => c.name));
    ch.islands = stop(iX0 + iSp, W * 0.6, 1.2, H * 0.7, dwellFor(n));
  }
  const iArr = ch.islands.each || COMMUNITIES.map(() => ch.islands.arrive);

  /* 4. The ghat: the boat docks and the scroll ends there. On wide screens the ghat runs
     off the right edge, so it reads as a riverside, not a cut-out block. */
  const gW = narrow ? W * 1.15 : clamp(H * 1.0, 620, 900);
  const gH = gW / GATE.ar;
  const gX = iX0 + iSp * (COMMUNITIES.length - 1) + W * 0.95;
  items.push({ id: 'ghat', kind: 'ghat', x: gX, base: H * (narrow ? 0.93 : 0.99), w: gW, h: gH });
  const gStart = s;
  travel(gX - (narrow ? W * 0.5 : Math.max(W * 0.66, W - gW / 2 + 40)), 1);
  ch.ghat = { start: gStart, arrive: s, leave: Infinity };

  /* A branch hangs in front of each landing until the boat reaches it. Last in the
     list, so it draws over the bank and the landing. */
  const brW = narrow ? W * 1.0 : LW * buildW * 0.85;
  const brH = (brW * M.branch.h) / M.branch.w;
  if (!reduced()) {
    LANDINGS.forEach((l, i) => {
      items.push({
        id: `br${l.year}`,
        kind: 'branch',
        i,
        dir: i % 2 ? -1 : 1,
        x: lx[i] + (i % 2 ? -1 : 1) * brW * 0.06,
        base: brH - H * 0.03,
        w: brW,
        h: brH,
      });
    });
  }

  /* The boat: left third, on the near-water line; the front water covers the keel. */
  const bW = narrow ? W * 0.56 : clamp(H * 0.4, 260, 400);
  const bH = bW / BOAT.ratio;
  /* The sun / moon: top right, clear of the header; on phones lower, under the cards. */
  const sunW = narrow ? 60 : clamp(H * 0.13, 84, 128);
  const sunX = narrow ? W * 0.8 : W * 0.8;
  const sunY = narrow ? Math.max(232, Hy - 150) : Math.max(70, H * 0.1);
  return {
    W,
    H,
    narrow,
    Hy,
    treeH,
    waterH,
    far,
    items,
    light,
    segs,
    ch,
    landings,
    cArr,
    iArr,
    end: s,
    total: s + H,
    boat: {
      width: px(bW),
      height: px(bH),
      left: px(narrow ? W * 0.01 : W * 0.06),
      top: px(H - waterH * 0.6 - bH),
    },
    sun: { left: px(sunX - sunW / 2), top: px(sunY), width: px(sunW), height: px(sunW) },
    sparks: {
      left: px(sunX - sunW * 0.9),
      top: px(Hy + 4),
      width: px(sunW * 1.8),
      height: px(Math.min((H - Hy) * 0.32, 120)),
    },
  };
}

function offsetAt(s) {
  const segs = plan.value.segs;
  for (const g of segs) {
    if (s <= g.s1) {
      const t = clamp((s - g.s0) / (g.s1 - g.s0), 0, 1);
      if (!g.ease) return g.x0;
      /* Reduced motion: the world cuts between stops instead of gliding. */
      if (reduced()) return t < 0.5 ? g.x0 : g.x1;
      return g.x0 + (g.x1 - g.x0) * smooth(t);
    }
  }
  return segs[segs.length - 1].x1;
}

/* 0..1 visibility for a chapter's caption at scroll s. */
function shown(c, s, H) {
  if (!c) return 0;
  const fade = H * 0.16;
  const a = clamp((s - (c.arrive - H * 0.3)) / fade, 0, 1);
  const b = c.leave === Infinity ? 1 : clamp((c.leave + H * 0.1 - s) / fade, 0, 1);
  return Math.min(a, b);
}

const t3 = (x, y = 0) =>
  `translate3d(${Math.round(x * 10) / 10}px, ${Math.round(y * 10) / 10}px, 0)`;

function update() {
  ticking = false;
  if (dead || props.leaving) return;
  const p = plan.value;
  const top = rootEl.value.getBoundingClientRect().top;
  const s = clamp(-top, 0, p.end);
  const off = offsetAt(s);
  syncVisible(p, off);
  const still = reduced();
  worldEl.value.style.transform = t3(-off);
  farEl.value.style.transform = t3(-off * p.far);
  treesEl.value.style.transform = t3(-((off * p.far) % (2 * tileW('farbank', p.treeH))));
  farWaterEl.value.style.transform = t3(-((off * p.far) % (2 * tileW('farwater', p.H - p.Hy))));
  waterEl.value.style.transform = t3(-((off * 1.25) % (2 * tileW('nearwater', p.waterH))));
  skyEl.value.style.transform = still ? '' : t3(-(off / Math.max(1, p.end)) * p.W * 0.03);
  if (still) boatEl.value.style.transform = '';
  else {
    boatEl.value.style.transform = `${t3(0, Math.sin(s / 140) * 3)} rotate(${(Math.sin(s / 95) * 1.1).toFixed(2)}deg)`;
  }
  const n = clamp((p.ch.note.leave + p.H * 0.25 - s) / (p.H * 0.25), 0, 1);
  noteEl.value.style.opacity = n.toFixed(3);
  /* The lighthouse belongs to the landings: it fades into the haze on the way to the
     council, so it never sits behind a council card or an island. */
  const lh = clamp((p.ch.landings.leave + p.H * 0.45 - s) / (p.H * 0.4), 0, 1);
  farEl.value.style.opacity = lh.toFixed(3);
  farEl.value.style.visibility = lh > 0 ? 'visible' : 'hidden';
  noteEl.value.style.visibility = n > 0 ? 'visible' : 'hidden';
  cueEl.value.style.opacity = clamp(1 - s / (p.H * 0.2), 0, 1).toFixed(3);

  /* Captions. The landings caption steps aside for the lighthouse card. */
  const m = shown(p.ch.milestone, s, p.H);
  let active = '';
  let best = 0.5;
  CAPTIONS.forEach((c, i) => {
    const el = capEls[i];
    if (!el) return;
    let o = shown(p.ch[c.id], s, p.H);
    /* One card at a time: the landings card leaves before the lighthouse card arrives. */
    if (c.id === 'landings') o = Math.min(o, clamp(1 - 2 * m, 0, 1));
    if (c.id === 'milestone') o = clamp(2 * m - 1, 0, 1);
    el.style.opacity = o.toFixed(3);
    el.style.visibility = o > 0 ? 'visible' : 'hidden';
    if (o > best) {
      best = o;
      active = c.id;
    }
  });
  activeCap.value = active;
  if (openP.value >= 0) {
    const person = p.items.find((it) => it.kind === 'council' && it.v === openP.value);
    if (active !== 'council' || !visibleItem(person)) closeP();
  }

  /* One-shot reveals. */
  p.landings.forEach((l, i) => {
    if (opened.has(i) || s < l.arrive - p.H * 0.32) return;
    opened.add(i);
    branchEls[i]?.classList.add('open');
  });
  if (!lit.value && p.ch.milestone && s >= p.ch.milestone.arrive - p.H * 0.06) lit.value = true;
  p.cArr.forEach((a, i) => {
    if (!hint.value[i] && s >= a - p.H * 0.2) hint.value[i] = true;
  });
  p.iArr.forEach((a, i) => {
    if (!glint.value[i] && s >= a - p.H * 0.12) glint.value[i] = true;
  });
  if (!docked.value && !skipping.value && s >= p.end - 1) dock();
}

function onScroll() {
  if (locked && Math.abs(window.scrollY - lockedAt) > 1) {
    window.scrollTo({ top: lockedAt, behavior: 'instant' });
    return;
  }
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(update);
}

function onResize() {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    /* Ignore the phone URL bar showing and hiding. */
    if (W === lastW && Math.abs(H - lastH) < 140) return;
    const before = plan.value;
    const s = clamp(window.scrollY, 0, before.end);
    const frac = s / before.end;
    lastW = W;
    lastH = H;
    plan.value = makePlan(W, H);
    nextTick(() => {
      /* Branches that were already pushed aside stay aside. */
      opened.forEach((i) => branchEls[i]?.classList.add('open'));
      const top = docked.value ? plan.value.end : frac * plan.value.end;
      if (locked) lockedAt = top;
      window.scrollTo({ top, behavior: 'instant' });
      update();
    });
  }, 150);
}

/* ---------- The ghat: the scroll stops, the name card comes up ---------- */

/* Docked at the ghat, the page stops scrolling: wheel, touch drags and scroll keys do
   nothing, and anything else that moves the page is put back. (Setting overflow on
   <html> would make <body> the scroller and unstick the stage.) */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
function stopScroll(e) {
  if (openId.value) {
    if (e.type === 'keydown' || sheetEl.value?.contains(e.target)) return;
    e.preventDefault();
    return;
  }
  /* A short screen (a phone held sideways) can make the ghat card taller than the stage:
     it scrolls inside itself (overscroll contained), the page still does not. */
  const body = cardBodyEl.value;
  if (e.type !== 'keydown' && body?.contains(e.target) && body.scrollHeight > body.clientHeight + 1)
    return;
  if (e.type === 'keydown') {
    const t = e.target;
    if (!SCROLL_KEYS.has(e.key) || t?.closest?.('input, textarea, button, label')) return;
  }
  e.preventDefault();
}
function lockScroll(on) {
  if (on === locked) return;
  locked = on;
  if (on) lockedAt = window.scrollY;
  const f = on ? 'addEventListener' : 'removeEventListener';
  window[f]('wheel', stopScroll, { passive: false });
  window[f]('touchmove', stopScroll, { passive: false });
  window[f]('keydown', stopScroll);
}

function dock() {
  stopAuto();
  docked.value = true;
  window.scrollTo({ top: plan.value.end, behavior: 'instant' });
  lockScroll(true);
  /* The name field when there is no name yet (a phone keyboard only opens on a tap). */
  nextTick(() =>
    (saved.value ? cardEl.value : nameEl.value || cardEl.value)?.focus({ preventScroll: true })
  );
}

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    await savePreferredName(nameDraft.value, phoneDraft.value.trim() || null);
    savedName.value = clean(nameDraft.value);
    saved.value = true;
    nextTick(() => enterEl.value?.focus({ preventScroll: true }));
  } catch (err) {
    saveError.value = errorText(err);
  } finally {
    saving.value = false;
  }
}

watch(saved, (on) => {
  if (!on) {
    nameDraft.value = savedName.value || nameDraft.value;
    nextTick(() => nameEl.value?.focus({ preventScroll: true }));
  }
});

/* ---------- Council thought bubbles ---------- */

function toggleP(i) {
  if (openP.value === i) return closeP();
  openP.value = i;
  met.value[i] = true;
  play('hi');
}

function closeP(refocus = false) {
  const i = openP.value;
  if (i < 0) return;
  openP.value = -1;
  if (refocus) whoEls[i]?.focus({ preventScroll: true });
}

/* Outside click closes the open bubble. A press on any character button is left to its
   click handler (a second tap on the same one closes it; another one switches). */
function onPointer(e) {
  if (openP.value < 0) return;
  const t = e.target;
  if (t?.closest?.('.c-say, .c-who')) return;
  closeP();
}

/* ---------- Islands ---------- */

async function openIsland(c) {
  closeP();
  play(c.sound);
  lastFocus = document.activeElement;
  openId.value = c.id;
  lockScroll(true);
  await nextTick();
  closeEl.value?.focus({ preventScroll: true });
}

async function closeIsland() {
  if (closingIsland || !openId.value) return;
  closingIsland = true;
  const el = sheetEl.value;
  if (el && !reduced()) {
    el.parentElement.classList.add('closing');
    await wait(narrowNow() ? 240 : 180);
  }
  openId.value = null;
  lockScroll(docked.value);
  closingIsland = false;
  /* The stage is inert while the sheet is open; focus back once it is not. */
  await nextTick();
  lastFocus?.focus?.({ preventScroll: true });
}

const narrowNow = () => window.innerWidth < 760;

function onKey(e) {
  if (openId.value && e.key === 'Tab') {
    const buttons = [...sheetEl.value.querySelectorAll('button, a[href], input, [tabindex="0"]')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (
      (e.shiftKey && document.activeElement === first) ||
      (!e.shiftKey && document.activeElement === last)
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first)?.focus({ preventScroll: true });
    }
  }
  if (e.key !== 'Escape') return;
  if (openId.value) closeIsland();
  else if (openP.value >= 0) closeP(true);
}

/* ---------- Row for me: the tour plays itself ---------- */

/* The boat rows between stops (clamp(distance / 0.45 W per s, 1.1s, 2.2s); the world still
   eases in and out of each stop, as with the wheel) and waits at each stop for its dwell.
   At the council it opens each thought bubble in turn. Any wheel, touch, key or tap hands
   control back. */
const auto = ref(false);
let autoRaf = 0;
let autoLast = 0;
let autoS = 0;
let autoOpened = -1;
const AUTO_KEYS = new Set([...SCROLL_KEYS, 'Escape']);

function segDur(g, W) {
  if (!g.ease) return g.dwell;
  return clamp(Math.abs(g.x1 - g.x0) / (0.45 * W), 1.1, 2.2);
}

function autoAct(g, s) {
  const list = g.act?.council;
  let want = -1;
  if (list) {
    const t = (s - g.s0) / (g.s1 - g.s0);
    /* Each bubble gets an equal slice of the hold, open for the middle of it. */
    const k = Math.min(list.length - 1, Math.floor(t * list.length));
    const u = t * list.length - k;
    if (u > 0.06 && u < 0.94) want = list[k];
  }
  if (want === openP.value) return;
  if (want >= 0) {
    openP.value = want;
    met.value[want] = true;
    autoOpened = want;
    /* Row for me was a tap, so sound is allowed. */
    play('hi');
  } else if (autoOpened >= 0 && openP.value === autoOpened) {
    openP.value = -1;
    autoOpened = -1;
  }
}

function autoStep(ts) {
  autoRaf = 0;
  if (!auto.value || dead || !motionActive()) return;
  const p = plan.value;
  const dt = autoLast ? Math.min(50, ts - autoLast) : 16;
  autoLast = ts;
  /* Something else moved the page (a resize re-plans and rescrolls): follow it. */
  if (Math.abs(window.scrollY - autoS) > 6) autoS = window.scrollY;
  const g = p.segs.find((x) => autoS < x.s1) || p.segs.at(-1);
  const rate = (g.s1 - g.s0) / (segDur(g, p.W) * 1000);
  autoS = Math.min(p.end, Math.min(g.s1 + 0.01, autoS + rate * dt));
  window.scrollTo({ top: autoS, behavior: 'instant' });
  autoAct(g, autoS);
  if (autoS >= p.end - 0.5) return stopAuto();
  autoRaf = requestAnimationFrame(autoStep);
}

function autoInput(e) {
  if (e.type === 'keydown' && !AUTO_KEYS.has(e.key)) return;
  if (e.type === 'pointerdown' && e.target?.closest?.('.t-auto')) return;
  stopAuto();
}

function startAuto() {
  if (auto.value || docked.value) return;
  auto.value = true;
  autoS = window.scrollY;
  autoLast = 0;
  window.addEventListener('wheel', autoInput, { passive: true });
  window.addEventListener('touchstart', autoInput, { passive: true });
  window.addEventListener('keydown', autoInput);
  window.addEventListener('pointerdown', autoInput);
  autoRaf = requestAnimationFrame(autoStep);
}

function stopAuto() {
  if (!auto.value) return;
  auto.value = false;
  cancelAnimationFrame(autoRaf);
  autoRaf = 0;
  window.removeEventListener('wheel', autoInput);
  window.removeEventListener('touchstart', autoInput);
  window.removeEventListener('keydown', autoInput);
  window.removeEventListener('pointerdown', autoInput);
  /* A bubble the tour opened by itself closes with it; one the member opened stays. */
  if (autoOpened >= 0 && openP.value === autoOpened) openP.value = -1;
  autoOpened = -1;
}

function toggleAuto() {
  if (auto.value) stopAuto();
  else startAuto();
}

/* Total Row for me time from the top to the ghat, in seconds (screenshot script). */
function autoTotal() {
  const p = plan.value;
  return p.segs.reduce((a, g) => a + segDur(g, p.W), 0);
}

/* ---------- Skip: row straight to the ghat (900ms), never past the name ---------- */

/* The world dips out (220ms), the boat keeps its place, the river jumps to just before
   the ghat and the last stretch rows in (650ms), then the name card comes up. Only the
   ghat's art loads; the chapters in between are never fetched. */
let skipFrame = () => {};
async function skip() {
  if (skipping.value || docked.value) return;
  stopAuto();
  closeP();
  const p = plan.value;
  if (reduced()) return dock();
  skipping.value = true;
  await wait(220);
  if (dead) return;
  const from = Math.max(window.scrollY, p.ch.ghat.start);
  window.scrollTo({ top: from, behavior: 'instant' });
  update();
  await nextTick();
  skipping.value = false;
  const t0 = motionNow();
  const D = 650;
  await new Promise((done) => {
    const step = (ts) => {
      if (dead) return done();
      if (reduced()) {
        window.scrollTo({ top: p.end, behavior: 'instant' });
        return done();
      }
      const t = clamp((ts - t0) / D, 0, 1);
      const e = 1 - (1 - t) ** 3;
      window.scrollTo({ top: from + (p.end - from) * e, behavior: 'instant' });
      if (t < 1) skipFrame = motionFrame(step);
      else done();
    };
    skipFrame = motionFrame(step);
  });
  if (!dead && !docked.value) dock();
}

/* "Not now": into the Lounge with no name. Home shows the empty lantern with "Name your
   lantern"; the roll number never stands in for the name. */
function notNow() {
  if (entering.value) return;
  entering.value = true;
  emit('done', null);
}

/* ---------- Arrival ---------- */

/* The garland on the gate sheds 12 petals that fall with gravity. They live in their own
   fixed layer on <body>, so they keep falling over Home while the tour fades. */
function shed() {
  const gate = gateName?.parentElement?.getBoundingClientRect();
  if (!gate) return;
  const layer = document.createElement('div');
  layer.className = 't-petals';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const H = window.innerHeight;
  const anims = [];
  for (let i = 0; i < 12; i++) {
    const img = document.createElement('img');
    img.src = petals[`./art/r3/petal-${i % 8}.webp`];
    img.alt = '';
    const size = 16 + Math.random() * 14;
    /* Along the garland: it hangs under the nameplate, sagging in the middle. */
    const u = (i + 0.5) / 12;
    const x = gate.left + gate.width * (0.04 + u * 0.92);
    const sag = Math.sin(u * Math.PI) * gate.height * 1.2;
    const y = gate.bottom + gate.height * 0.5 + sag;
    img.style.width = `${size}px`;
    img.style.left = `${x - size / 2}px`;
    img.style.top = `${y - size / 2}px`;
    layer.appendChild(img);
    const fall = H * (0.32 + Math.random() * 0.22);
    const dx = (Math.random() - 0.5) * 90;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 300);
    anims.push(
      animate(
        img,
        [
          { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 0 },
          { opacity: 1, offset: 0.08 },
          { opacity: 1, offset: 0.75 },
          { transform: `translate3d(${dx}px, ${fall}px, 0) rotate(${spin}deg)`, opacity: 0 },
        ],
        {
          duration: 1600 + Math.random() * 600,
          delay: i * 45 + Math.random() * 60,
          easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
          fill: 'both',
        }
      ).finished
    );
  }
  Promise.allSettled(anims).then(() => layer.remove());
}

function rectOf(el) {
  const r = el?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

async function enter() {
  if (entering.value) return;
  entering.value = true;
  play('celebrate');
  if (!reduced()) shed();
  /* The card leaves first (0-250ms); then Home takes over and the world fades. */
  await wait(reduced() ? 0 : 350);
  if (dead) return;
  const from = rectOf(gateName);
  emit('done', from ? { from, boat: rectOf(boatEl.value) } : null);
}

/* Home takes over underneath: freeze the stage where it is and fade it out. The boat and
   the name are the two things that carry over: Home flies its own from the rects handed
   over in `done`, so the tour's copies go at once. */
watch(
  () => props.leaving,
  async (on) => {
    if (!on) return;
    stopAuto();
    lockScroll(false);
    stopShoot?.();
    stopBirds?.();
    await nextTick();
    if (entering.value && gateName) {
      gateName.style.opacity = '0';
      if (boatEl.value) boatEl.value.style.opacity = '0';
    }
    const el = rootEl.value;
    if (!el) return emit('gone');
    if (reduced()) return emit('gone');
    await tourAnimate(el, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 650,
      easing: 'ease-out',
      fill: 'forwards',
    }).finished.catch(() => {});
    emit('gone');
  }
);

/* ---------- Night sky: a shooting star now and then ---------- */

function shoot() {
  const el = shootEl.value;
  const sky = skyEl.value;
  if (!el || !sky) return;
  const r = sky.getBoundingClientRect();
  const x = r.width * (0.12 + Math.random() * 0.5);
  const y = r.height * (0.06 + Math.random() * 0.3);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const ang = 14 + Math.random() * 12;
  tourAnimate(
    el,
    [
      { transform: `rotate(${ang}deg) translate3d(0,0,0) scaleX(0.4)`, opacity: 0 },
      { opacity: 0.85, offset: 0.25 },
      { transform: `rotate(${ang}deg) translate3d(${r.width * 0.22}px,0,0) scaleX(1)`, opacity: 0 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' }
  );
}

function birds() {
  const host = birdsEl.value;
  if (!host) return;
  const flock = document.createElement('span');
  flock.className = 't-flock';
  flock.style.top = px(plan.value.Hy * 0.22);
  for (let i = 0; i < 3; i++) {
    const bird = document.createElement('span');
    bird.style.cssText = `left:${-i * 34}px;top:${(i % 2) * 13}px`;
    const img = document.createElement('img');
    img.src = BIRDS;
    img.alt = '';
    bird.appendChild(img);
    flock.appendChild(bird);
  }
  host.appendChild(flock);
  tourAnimate(
    flock,
    [
      { transform: 'translate3d(-60px,0,0)', opacity: 0 },
      { opacity: 1, offset: 0.1 },
      { opacity: 1, offset: 0.9 },
      { transform: `translate3d(${plan.value.W + 160}px,-24px,0)`, opacity: 0 },
    ],
    { duration: 11000, easing: 'linear' }
  ).finished.then(
    () => flock.remove(),
    () => flock.remove()
  );
}
function onMotionPreference() {
  reduceMotion.value = reduced();
  if (reduceMotion.value) {
    stopAuto();
    animations.forEach((animation) => animation.cancel());
    if (!props.leaving) update();
  }
}
let stopActivity = () => {};
function onActivity(active) {
  cancelAnimationFrame(autoRaf);
  autoRaf = 0;
  autoLast = 0;
  if (active && auto.value && !dead) autoRaf = requestAnimationFrame(autoStep);
}

onMounted(() => {
  /* Test hook for the screenshot script: scroll positions where each stop settles. */
  window.__loungeTour = () => {
    const p = plan.value;
    return {
      end: p.end,
      landings: p.landings.map((l) => l.arrive),
      milestone: p.ch.milestone?.arrive,
      council: p.ch.council.each || [p.ch.council.arrive],
      islands: p.ch.islands.each || [p.ch.islands.arrive],
      ghat: p.ch.ghat.arrive,
      autoSeconds: Math.round(autoTotal() * 10) / 10,
      autoSegs: p.segs.map((g) => `${g.ease ? 'row' : 'hold'} ${segDur(g, p.W).toFixed(1)}`),
    };
  };
  window.scrollTo({ top: 0, behavior: 'instant' });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);
  stopActivity = onMotionChange(onActivity);
  motionPreference.addEventListener('change', onMotionPreference);
  if (!reduced()) {
    stopShoot = rare(shoot, {
      first: 3500,
      min: 25000,
      max: 45000,
      when: () => mode.value === 'night' && !props.leaving && !lite,
    });
  }
  if (!reduced()) {
    stopBirds = rare(birds, {
      first: 2500,
      min: 22000,
      max: 36000,
      when: () => mode.value === 'day' && !props.leaving && !lite,
    });
  }
  update();
});

onBeforeUnmount(() => {
  dead = true;
  skipFrame();
  stopAuto();
  lockScroll(false);
  stopShoot?.();
  stopBirds?.();
  delete window.__loungeTour;
  stopActivity();
  motionPreference.removeEventListener('change', onMotionPreference);
  animations.forEach((animation) => animation.cancel());
  clearTimeout(resizeT);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerdown', onPointer);
});
</script>
