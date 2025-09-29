import fs from 'fs/promises';
import path from 'path';
import XmlStream from 'xml-stream';
import axios from 'axios';

const EPG_URL = 'https://xmltvfr.fr/xmltv/xmltv.xml';
// In Vercel's serverless environment, /tmp is the only writable directory.
const EPG_INPUT_FILE = '/tmp/guide.xml';
// Vercel serves the 'public' directory at the root.
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'api');

async function processEpg() {
  console.log('Starting EPG processing...');

  // 0. Download the latest EPG file to the /tmp directory
  try {
    console.log(`Downloading EPG from ${EPG_URL}...`);
    const response = await axios({
      method: 'get',
      url: EPG_URL,
      responseType: 'stream'
    });
    await fs.writeFile(EPG_INPUT_FILE, response.data);
    console.log('EPG file downloaded successfully.');
  } catch (error) {
    console.error('Failed to download EPG file:', error);
    throw new Error('EPG download failed.');
  }

  // 1. Ensure output directory exists
  const programsDir = path.join(OUTPUT_DIR, 'programs');
  await fs.mkdir(programsDir, { recursive: true });

  // 2. Process the file
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(EPG_INPUT_FILE);
    const xml = new XmlStream(stream);

    const channels = [];
    const programsByChannel = {};
    const uniqueChannelNames = new Set();

    xml.on('endElement: channel', function(item) {
      const channelId = item.$.id;
      const channelName = item['display-name'].$text;
      if (channelId.endsWith('.fr') && !uniqueChannelNames.has(channelName)) {
        channels.push({ id: channelId, name: channelName });
        uniqueChannelNames.add(channelName);
        programsByChannel[channelId] = [];
      }
    });

    xml.on('endElement: programme', function(item) {
      const channelId = item.$.channel;
      if (programsByChannel[channelId]) {
        programsByChannel[channelId].push({
          start: item.$.start,
          stop: item.$.stop,
          title: item.title?.$text || '',
          desc: item.desc?.$text || '',
          category: item.category?.$text || ''
        });
      }
    });

    xml.on('end', async () => {
      try {
        console.log(`Found ${channels.length} channels.`);
        const channelsPath = path.join(OUTPUT_DIR, 'channels.json');
        await fs.writeFile(channelsPath, JSON.stringify(channels, null, 2));
        console.log(`Successfully wrote ${channelsPath}`);

        let programsCount = 0;
        for (const channelId in programsByChannel) {
          const channelPrograms = programsByChannel[channelId];
          if (channelPrograms.length > 0) {
            const programFilePath = path.join(programsDir, `${channelId}.json`);
            await fs.writeFile(programFilePath, JSON.stringify(channelPrograms, null, 2));
            programsCount += channelPrograms.length;
          }
        }
        console.log(`Wrote files for ${Object.keys(programsByChannel).length} channels, total ${programsCount} programs.`);
        resolve('EPG processing finished successfully!');
      } catch (writeError) {
        reject(writeError);
      }
    });

    xml.on('error', (err) => {
      console.error('XML stream error:', err);
      reject(err);
    });
  });
}

// This is the serverless function handler Vercel will call
export default async function handler(request, response) {
  try {
    const result = await processEpg();
    response.status(200).send(result);
  } catch (error) {
    console.error('Handler error:', error);
    response.status(500).send(`Failed to process EPG: ${error.message}`);
  }
}
