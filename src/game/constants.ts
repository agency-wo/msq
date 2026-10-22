/** Ids shared by the simulation and the renderer. Plain numbers so they fit in typed arrays. */

export const FLAG_ELITE = 1;
export const FLAG_BOSS = 2;
/** Risen by The Zombie: fights for you, crumbles when its time runs out, drops nothing. */
export const FLAG_ZOMBIE = 4;
/** Charmed with Heartbreak: bursts when the charm ends or it dies. */
export const FLAG_HEARTBREAK = 8;
/** Zombie with Plague: infects what it hits. */
export const FLAG_PLAGUE = 16;
/** Zombie with Blood Burst: bursts when it falls. */
export const FLAG_BLOODBURST = 32;
/** Event enemies (rifts, golden runners): no knockback, holds, charm or zombies, no contact damage. */
export const FLAG_EVENT = 64;
/** A charging formation: stands through its warning, then runs straight along (sx, sy) and leaves at the far side. */
export const FLAG_STAMPEDE = 128;

/** Projectile kinds. */
export const PK_ARROW = 0;
export const PK_BLADE = 1;
export const PK_SHARD = 2;
export const PK_PETAL = 3;
export const PK_BOMB = 4;
export const PK_THORN = 5;
export const PK_MISSILE = 6;
export const PK_DRAGON = 7;
export const PK_DRONE = 8;
export const PK_HEART = 9;
export const PK_BLOOD = 10;

/** Projectile flags. */
export const PF_SPECIAL = 1; // arrows burst (Sprenger), blades throw shards
export const PF_HOMING = 2;
export const PF_STUN = 4;
export const PF_FREEZE = 8;
export const PF_VOLATILE = 16;
export const PF_CLUSTER = 32;
export const PF_BURST = 64;
export const PF_CHARM = 128; // pa = charm seconds, pb = charmed damage per second
export const PF_INFECT = 256; // pa = infection seconds

/** Visual effect sprites; the renderer maps each to an atlas frame. */
export const FX_GLOW = 0;
export const FX_RING = 1;
export const FX_SPARK = 2;
export const FX_DOT = 3;
export const FX_BEAM = 4;
export const FX_BOLT = 5;
export const FX_SHARD = 6;
export const FX_BEAMH = 7;
export const FX_FLAME = 8;
export const FX_METEOR = 9;
export const FX_MASK = 10;
export const FX_ASH = 11;
export const FX_CRESCENT = 12;
export const FX_AVATAR = 13;
export const FX_WINGS = 14;
export const FX_STAR = 15;
export const FX_SNOW = 16;
export const FX_PETAL = 17;
export const FX_MISSILE = 18;
export const FX_MAW = 19;
export const FX_FIST = 20;
export const FX_EYE = 21;
export const FX_LIGHTNING = 22; // a bolt from the sky; sy = its height
export const FX_SHOCK = 23; // a filled shockwave ring
export const FX_SMOKE = 24;

/** Effect blend layers. */
export const LAYER_NORMAL = 0;
export const LAYER_ADD = 1;

/** Zone kinds: lingering areas. */
export const ZK_FIRE = 0;
export const ZK_POISON = 1;
export const ZK_GUST = 2;
export const ZK_PETALS = 3;
export const ZK_FROST = 4;
export const ZK_HEAT = 5;
/** The Jail: holds every non-boss enemy inside; extra = burst damage when it opens (Execution). */
export const ZK_CAGE = 6;
/** A stage hazard's lingering patch: sinking sand, or a pool of shadow (extra 1). */
export const ZK_MIRE = 7;

/** Zone flags. */
export const ZF_FOLLOW = 1; // sits on the player
export const ZF_ENEMY = 2; // hurts the player instead of enemies
export const ZF_PULL = 4;
export const ZF_PUSH = 8;
export const ZF_VULN = 16; // enemies inside take extra damage from everything
export const ZF_WANDER = 32;
export const ZF_SPREAD = 64; // kills inside spawn a new, smaller zone
export const ZF_FREEZE = 128;
export const ZF_BLAZE = 256; // Firestorm: burns what it touches and leaves fire behind (aux = burn damage)
export const ZF_SLOWS = 512; // slows the player standing in it (with ZF_ENEMY)

/** Mark kinds: delayed strikes with a warning shape. */
export const MK_METEOR = 0;
export const MK_MISSILE = 1;
export const MK_CERO = 2;
export const MK_PILLAR = 3;
export const MK_ICE = 4;
export const MK_SLASH = 5;
export const MK_FIRE = 6;
export const MK_RAIN = 7;
export const MK_SEAL = 8;
export const MK_LANCE = 9;
export const MK_INFERNO = 10; // a circle of fire erupting (the Captain-Commander)
export const MK_STEAM = 11; // a boiling geyser (Tenjirō)
export const MK_INK = 12; // a stroke or pool of ink (Ichibē)
export const MK_THREAD = 13; // a binding thread or closing cloth (Senjumaru)
export const MK_SWORD = 14; // a falling blade (Ōetsu)
export const MK_WATER = 15; // a lane or a falling torrent of water (Harribel)
export const MK_GAS = 16; // a cloud of poison gas (Mayuri, his specimens, Konjiki Ashisogi Jizō)
export const MK_MIST = 17; // Sakanade's sweet mist: it does no harm, it turns you around (Shinji)
export const MK_SILVER = 18; // the silver arrow: struck, The Almighty falls silent for a while (Uryū)
export const MK_LANE = 20; // a charging formation's lane: a warning only, it strikes nothing
export const MK_STING = 19; // Suì-Fēng's sting: the first marks you with the Hōmonka, a second on the mark strikes three times as hard

/** Mark shapes. */
export const MS_CIRCLE = 0;
export const MS_LINE = 1;
export const MS_ARC = 2;

/** Mark flags. */
export const MF_ENEMY = 1; // aimed at the player
export const MF_FREEZE = 2;
export const MF_CRATER = 4; // leaves a burning crater
export const MF_BURN = 8;
export const MF_SLOW = 16; // slows the player on hit
export const MF_ROOT = 32; // roots the player in place on hit
export const MF_SHATTER = 64; // Armageddon: the impact flings reishi bombs
export const MF_INVERT = 128; // inverts the player's directions for a while (Sakanade)

/** Enemy bullet kinds and flags. */
export const EB_BALA = 0;
export const EB_PETAL = 1;
export const EB_ICE = 2;
export const EB_FIRE = 3; // Kidō fireball
export const EB_WAVE = 4; // sword wave
export const EB_SWORD = 5; // a flying asauchi (Ōetsu)
export const EB_THREAD = 6; // a weaver's thread
export const EB_WATER = 7; // a wave of water (Harribel's Ola Azul)
export const EB_GETSUGA = 8; // Getsuga Tenshō (Ichigo)
export const EB_ARROW = 9; // a Quincy's arrow of light (Uryū)
export const EBF_SLOW = 1;
export const EBF_ROOT = 2; // roots you briefly

/** Enemy movement behaviours (EnemyDef.behavior as a byte). */
export const BH_CHASE = 0;
export const BH_BLINK = 1;
export const BH_RANGED = 2;
export const BH_FLEE = 3;
export const BH_CHARGE = 4;

/** Why an enemy cannot move (drives its tint). */
export const HOLD_FREEZE = 0;
export const HOLD_FEAR = 1;
export const HOLD_JAIL = 2;
export const HOLD_STUN = 3;

/** Damage-over-time kinds. */
export const DOT_FIRE = 0;
export const DOT_POISON = 1;
