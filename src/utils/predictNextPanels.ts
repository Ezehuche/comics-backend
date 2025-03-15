import { GeneratedPanel, LLMVendorConfig } from './types';
// import { cleanJson } from './cleanJson';
import { dirtyGeneratedPanelCleaner } from './dirtyGeneratedPanelCleaner';
import { dirtyGeneratedPanelsParser } from './dirtyGeneratedPanelsParser';
import { sleep } from './sleep';

import { Preset } from './presets';
import { predict } from './predict';
// import { getSystemPrompt } from './getSystemPrompt';
import { useSystemPrompt } from './useSystemPrompt';
import { getUserPrompt } from './getUserPrompt';

export const predictNextPanels = async ({
  preset,
  prompt = '',
  nbPanelsToGenerate,
  maxNbPanels,
  existingPanels = [],
  llmVendorConfig,
  test = false,
}: {
  preset: Preset;
  prompt: string;
  nbPanelsToGenerate: number;
  maxNbPanels: number;
  existingPanels: GeneratedPanel[];
  llmVendorConfig: LLMVendorConfig;
  test?: boolean;
}): Promise<GeneratedPanel[]> => {
  console.log(test);
  // console.log("predictNextPanels: ", { prompt, nbPanelsToGenerate })
  // throw new Error("Planned maintenance")

  // In case you need to quickly debug the RENDERING engine you can uncomment this:
  // return mockGeneratedPanels

  const existingPanelsTemplate = existingPanels.length
    ? ` To help you, here are the previous panels, their speeches and captions (note: if you see an anomaly here eg. no speech, no caption or the same description repeated multiple times, do not hesitate to fix the story): ${JSON.stringify(existingPanels, null, 2)}`
    : '';

  const firstNextOrLast =
    existingPanels.length === 0
      ? 'first'
      : maxNbPanels - existingPanels.length === maxNbPanels
        ? 'last'
        : 'next';

  const systemPrompt: string = useSystemPrompt({
    preset,
    firstNextOrLast,
    maxNbPanels,
    nbPanelsToGenerate,
  });

  // if (test) {
  //   systemPrompt = useSystemPrompt({
  //     preset,
  //     firstNextOrLast,
  //     maxNbPanels,
  //     nbPanelsToGenerate,
  //   });
  // } else {
  //   systemPrompt = getSystemPrompt({
  //     preset,
  //     firstNextOrLast,
  //     maxNbPanels,
  //     nbPanelsToGenerate,
  //   });
  // }

  const userPrompt = getUserPrompt({
    prompt,
    existingPanelsTemplate,
  });

  let result = '';

  // we don't require a lot of token for our task,
  // but to be safe, let's count ~200 tokens per panel
  const nbTokensPerPanel = 200;

  const nbMaxNewTokens = nbPanelsToGenerate * nbTokensPerPanel;

  try {
    // console.log(`calling predict:`, { systemPrompt, userPrompt, nbMaxNewTokens })
    result = `${await predict({
      systemPrompt,
      userPrompt,
      nbMaxNewTokens,
      llmVendorConfig,
    })}`.trim();
    console.log('LLM result (1st trial):', result);
    if (!result.length) {
      throw new Error('empty result on 1st trial!');
    }
  } catch (err) {
    console.log(err);
    // console.log(`prediction of the story failed, trying again..`)
    // this should help throttle things on a bit on the LLM API side
    await sleep(2000);

    try {
      result = `${await predict({
        systemPrompt: systemPrompt + ' \n ',
        userPrompt,
        nbMaxNewTokens,
        llmVendorConfig,
      })}`.trim();
      console.log('LLM result (2nd trial):', result);
      if (!result.length) {
        throw new Error('empty result on 2nd trial!');
      }
    } catch (err) {
      console.error(`prediction of the story failed twice 💩`);
      throw new Error(`failed to generate the story twice 💩 ${err}`);
    }
  }

  console.log('Raw response from LLM:', result);
  // const match = result.match(/\[.*\]/s);
  // const tmp = match ? JSON.parse(match[0]) : [];
  // const tmp = cleanJson(result);
  console.log('Clean response from LLM:', result);

  let generatedPanels: GeneratedPanel[] = [];

  try {
    generatedPanels = dirtyGeneratedPanelsParser(result);
    console.log('Parsed response from LLM:', result);
  } catch (err) {
    console.log(err);
    // console.log(`failed to read LLM response: ${err}`)
    // console.log(`original response was:`, result)

    // in case of failure here, it might be because the LLM hallucinated a completely different response,
    // such as markdown. There is no real solution.. but we can try a fallback:

    generatedPanels = result
      .split('*')
      .map((item) => item.trim())
      .map((cap, i) => ({
        panel: i,
        caption: cap,
        speech: cap,
        instructions: cap,
      }));
  }

  return generatedPanels.map((res) => dirtyGeneratedPanelCleaner(res));
};
