import { xml2js } from 'xml-js';
import * as fs from 'fs';

// Copied from tvGuideService.ts
const getText = (element: any): string => {
  if (!element || !element.elements || element.elements.length === 0) {
    return '';
  }
  return element.elements[0].text || '';
};

const parseEpgDate = (epgDate: string): Date => {
  const year = parseInt(epgDate.substring(0, 4), 10);
  const month = parseInt(epgDate.substring(4, 6), 10) - 1;
  const day = parseInt(epgDate.substring(6, 8), 10);
  const hour = parseInt(epgDate.substring(8, 10), 10);
  const minute = parseInt(epgDate.substring(10, 12), 10);
  const second = parseInt(epgDate.substring(12, 14), 10);
  return new Date(year, month, day, hour, minute, second);
};

const testParse = () => {
  console.log('Reading guide.xml...');
  const xmlText = fs.readFileSync('./guide.xml', 'utf-8');
  console.log(`File read successfully, ${xmlText.length} characters.`);

  const epgJson: any = xml2js(xmlText, { compact: false });

  const tvElement = epgJson.elements.find((el: any) => el.name === 'tv');
  if (!tvElement) {
    console.error('No <tv> element found in EPG data');
    return;
  }

  const channelMap = new Map<string, string>();
  const channelElements = tvElement.elements.filter((el: any) => el.name === 'channel');
  for (const channelEl of channelElements) {
    const id = channelEl.attributes.id;
    const displayName = getText(channelEl.elements.find((el: any) => el.name === 'display-name'));
    if (id && displayName) {
      channelMap.set(id, displayName);
    }
  }
  console.log(`Found ${channelMap.size} channels.`);

  const programElements = tvElement.elements.filter((el: any) => el.name === 'programme');
  console.log(`Found ${programElements.length} program entries.`);

  const allGenres = new Set<string>();
  for (const programEl of programElements) {
    const genre = getText(programEl.elements.find((el: any) => el.name === 'category'));
    if (genre) {
      allGenres.add(genre);
    }
  }

  console.log('--- Unique Genres Found ---');
  console.log(Array.from(allGenres).sort());
};

testParse();
