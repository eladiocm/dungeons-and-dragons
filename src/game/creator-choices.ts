import {
  BACKGROUNDS,
  CLASSES,
  FEATS,
  SKILLS,
  SPELLS,
  WEAPONS,
} from './catalog.ts';
import { weaponProficient } from './character.ts';
import type {
  CharacterDraft,
  MagicChoice,
  OriginFeat,
  SkillId,
} from './types.ts';
/** Suggestions only: every visible choice remains editable and server creation validates again. */
export function recommendChoices(input: CharacterDraft): CharacterDraft {
  const d = structuredClone(input),
    background = BACKGROUNDS[d.backgroundId],
    cls = CLASSES[d.classId];
  const best = [...background.abilities].sort(
    (a, b) => d.baseAbilities[b] - d.baseAbilities[a],
  );
  d.boosts = { [best[0]]: 2, [best[1]]: 1 };
  if (d.humanFeat === background.feat && d.humanFeat !== 'skilled')
    d.humanFeat =
      (Object.keys(FEATS) as OriginFeat[]).find((f) => f !== background.feat) ||
      'alert';
  const taken = new Set<SkillId>(background.skills);
  d.classSkills = [];
  // Reserve the selected elven sense so it doesn't silently lose an election.
  for (const skill of [...input.classSkills, ...cls.skills])
    if (
      !taken.has(skill) &&
      cls.skills.includes(skill) &&
      d.classSkills.length < cls.skillCount &&
      (d.speciesId !== 'high-elf' || skill !== d.elfSkill)
    ) {
      d.classSkills.push(skill);
      taken.add(skill);
    }
  for (const skill of cls.skills)
    if (!taken.has(skill) && d.classSkills.length < cls.skillCount) {
      d.classSkills.push(skill);
      taken.add(skill);
    }
  d.replacements = [];
  const add = (skill: SkillId) => {
    if (taken.has(skill)) {
      const replacement = (Object.keys(SKILLS) as SkillId[]).find(
        (s) => !taken.has(s),
      );
      if (replacement) {
        d.replacements.push(replacement);
        taken.add(replacement);
      }
    } else taken.add(skill);
  };
  if (d.speciesId === 'human') {
    if (taken.has(d.extraSkill))
      d.extraSkill =
        (Object.keys(SKILLS) as SkillId[]).find((s) => !taken.has(s)) ||
        'perception';
    add(d.extraSkill);
    if (d.humanFeat === 'skilled') {
      d.skilledChoices = (Object.keys(SKILLS) as SkillId[])
        .filter((s) => !taken.has(s))
        .slice(0, 3);
      for (const s of d.skilledChoices) taken.add(s as SkillId);
    }
  }
  if (d.speciesId === 'high-elf') add(d.elfSkill);
  d.expertise =
    d.classId === 'rogue'
      ? [...new Set([...input.expertise, ...taken])]
          .filter((s) => taken.has(s))
          .slice(0, 2)
      : [];
  const features = d.classId === 'cleric' ? [d.divineOrder] : [];
  d.weaponMasteries = [
    ...new Set([...input.weaponMasteries, ...Object.keys(WEAPONS)]),
  ]
    .filter((w) => weaponProficient({ classId: d.classId, features }, w))
    .slice(0, d.classId === 'fighter' ? 3 : d.classId === 'rogue' ? 2 : 0);
  if (d.classId !== 'fighter') d.equipment = 'A';
  if (d.classId === 'cleric' || d.classId === 'wizard') {
    const count =
      d.classId === 'cleric' && d.divineOrder === 'thaumaturge' ? 4 : 3;
    d.cantrips = [...new Set([...d.cantrips, ...Object.keys(SPELLS)])]
      .filter(
        (s) =>
          SPELLS[s].level === 0 &&
          SPELLS[s].lists.includes(d.classId as 'cleric' | 'wizard'),
      )
      .slice(0, count);
  }
  const origins = [
    { source: 'background' as const, feat: background.feat },
    ...(d.speciesId === 'human'
      ? [{ source: 'human' as const, feat: d.humanFeat }]
      : []),
  ];
  d.magic = origins.flatMap(({ source, feat }) => {
    if (feat !== 'magicCleric' && feat !== 'magicWizard') return [];
    const list = feat === 'magicCleric' ? 'cleric' : 'wizard',
      prior = input.magic.find((m) => m.source === source && m.list === list);
    return [
      prior ||
        ({
          source,
          list,
          ability: list === 'cleric' ? 'wis' : 'int',
          cantrips: Object.keys(SPELLS)
            .filter(
              (s) => SPELLS[s].level === 0 && SPELLS[s].lists.includes(list),
            )
            .slice(0, 2),
          spell: list === 'cleric' ? 'healingWord' : 'featherFall',
        } satisfies MagicChoice),
    ];
  });
  return d;
}
