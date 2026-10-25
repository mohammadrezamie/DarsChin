import type { Major } from '../types';

export type MajorGroup={key:string;label:string;members:Major[]};

/**
 * An academic major is currently stored once per degree. Present equivalent
 * names as one navigable major while retaining original distinct row IDs and
 * degree relationships. Never rewrite/merge historical records in the database.
 */
export const academicMajorKey=(value:string)=>
  value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('fa');

export function groupAcademicMajors(majors:Major[]):MajorGroup[]{
  const grouped=new Map<string,MajorGroup>();
  for(const major of majors){
    if(major.active===false)continue;
    const key=academicMajorKey(major.name);
    if(!key)continue;
    let found=grouped.get(key);
    if(!found){
      found={key,label:major.name.trim(),members:[]};
      grouped.set(key,found);
    }
    found.members.push(major);
  }
  return [...grouped.values()].sort((a,b)=>a.label.localeCompare(b.label,'fa'));
}
