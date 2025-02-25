/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
// import { FXQLService } from 'src/services/fxql.service';
import { newRender, getRender } from 'src/utils/render';
import { getStoryContinuation } from 'src/utils/getStoryContinuation';
import { Preset, getPreset } from 'src/utils/presets';
import {
  GeneratedPanel,
  Settings,
  LLMVendor,
  RenderingModelVendor,
} from 'src/utils/types';
import { joinWords } from 'src/utils/joinWords';
import { getValidString } from 'src/utils/getValidString';
import { defaultSettings } from 'src/utils/defaultSettings';
import { getValidBoolean } from 'src/utils/getValidBoolean';
import { getValidNumber } from 'src/utils/getValidNumber';
import { injectSpeechBubbleInTheBackground } from 'src/utils/generateSpeechBubble';

interface Render {
  id: string;
  renderId: string;
  status?: string;
  width: number;
  height: number;
  assetUrl: string;
  speechUrl?: string;
  alt: string;
  error?: string;
  maskUrl?: string;
  segments?: any;
}

interface Panel {
  panel: number;
  instructions?: string;
  caption?: string;
  speech?: string;
}

interface Scene {
  renderedScenes: Render[];
  storyPanels: Panel[];
}

const layouts = {
  Layout0: [
    { panel: 0, width: 1024, height: 1024 },
    { panel: 1, width: 1024, height: 1024 },
    { panel: 2, width: 1024, height: 1024 },
    { panel: 3, width: 1024, height: 1024 },
  ],
  Layout1: [
    { panel: 0, width: 1024, height: 768 },
    { panel: 1, width: 768, height: 1024 },
    { panel: 2, width: 768, height: 1024 },
    { panel: 3, width: 1024, height: 768 },
  ],
  Layout2: [
    { panel: 0, width: 768, height: 1024 },
    { panel: 1, width: 768, height: 1024 },
    { panel: 2, width: 512, height: 1024 },
    { panel: 3, width: 1024, height: 768 },
  ],
  Layout3: [
    { panel: 0, width: 1024, height: 768 },
    { panel: 1, width: 768, height: 1024 },
    { panel: 2, width: 768, height: 1024 },
    { panel: 3, width: 1024, height: 768 },
  ],
  Layout4: [
    { panel: 0, width: 512, height: 1024 },
    { panel: 1, width: 1024, height: 768 },
    { panel: 2, width: 768, height: 1024 },
    { panel: 3, width: 1024, height: 512 },
  ],
};

const addSpeechBubble = async (
  url: string,
  speech: string,
  bubbleShape: string,
  fontSize: number,
) => {
  // story generation failed
  if (speech.trim() === '...') {
    return;
  }

  console.log('Generating speech bubbles (this is experimental!)');
  try {
    const result = await injectSpeechBubbleInTheBackground({
      inputImageInBase64: url,
      text: speech,
      shape: bubbleShape as 'oval' | 'rectangular' | 'cloud' | 'thought',
      line: 'straight', // "straight", "bubble", "chaotic"
      fontSize,
      // debug: true,
    });
    return { url: result };
  } catch (err) {
    console.log(`error: failed to inject the speech bubble: ${err}`);
    return { error: err };
  }
};

const settings = {
  renderingModelVendor: getValidString(
    null,
    defaultSettings.renderingModelVendor,
  ) as RenderingModelVendor,
  renderingUseTurbo: getValidBoolean(null, defaultSettings.renderingUseTurbo),
  llmVendor: getValidString(null, defaultSettings.llmVendor) as LLMVendor,
  huggingFaceOAuth: getValidString(null, defaultSettings.huggingFaceOAuth),
  huggingfaceApiKey: getValidString(null, defaultSettings.huggingfaceApiKey),
  huggingfaceInferenceApiModel: getValidString(
    null,
    defaultSettings.huggingfaceInferenceApiModel,
  ),
  huggingfaceInferenceApiModelTrigger: getValidString(
    null,
    defaultSettings.huggingfaceInferenceApiModelTrigger,
  ),
  huggingfaceInferenceApiFileType: getValidString(
    null,
    defaultSettings.huggingfaceInferenceApiFileType,
  ),
  replicateApiKey: getValidString(null, defaultSettings.replicateApiKey),
  replicateApiModel: getValidString(null, defaultSettings.replicateApiModel),
  replicateApiModelVersion: getValidString(
    null,
    defaultSettings.replicateApiModelVersion,
  ),
  replicateApiModelTrigger: getValidString(
    null,
    defaultSettings.replicateApiModelTrigger,
  ),
  openaiApiKey: getValidString(null, defaultSettings.openaiApiKey),
  openaiApiModel: getValidString(null, defaultSettings.openaiApiModel),
  openaiApiLanguageModel: getValidString(
    null,
    defaultSettings.openaiApiLanguageModel,
  ),
  groqApiKey: getValidString(null, defaultSettings.groqApiKey),
  groqApiLanguageModel: getValidString(
    null,
    defaultSettings.groqApiLanguageModel,
  ),
  anthropicApiKey: getValidString(null, defaultSettings.anthropicApiKey),
  anthropicApiLanguageModel: getValidString(
    null,
    defaultSettings.anthropicApiLanguageModel,
  ),
  hasGeneratedAtLeastOnce: getValidBoolean(
    null,
    defaultSettings.hasGeneratedAtLeastOnce,
  ),
  userDefinedMaxNumberOfPages: getValidNumber(
    null,
    1,
    Number.MAX_SAFE_INTEGER,
    defaultSettings.userDefinedMaxNumberOfPages,
  ),
};

@ApiTags('Generate Comics')
@Controller('api')
@UseGuards(ThrottlerGuard)
export class GenerateController {
  constructor() {}

  @Post('/generateComic')
  @ApiBody({
    schema: {
      example: {
        prompt: '',
        stylePrompt: '',
      },
    },
  })
  async generateComics(@Body() body: any) {
    try {
      const {
        prompt,
        stylePrompt,
        presetName,
        nbPanelsToGenerate,
        speechBubble,
        layout,
        existingPages = [],
        fontSize,
        bubbleShape,
      }: {
        prompt: string;
        stylePrompt: string;
        presetName: string;
        nbPanelsToGenerate: number;
        layout: keyof typeof layouts;
        speechBubble: boolean;
        existingPages: Scene[];
        fontSize: number;
        bubbleShape: string;
      } = body;

      if (!prompt || !presetName || !nbPanelsToGenerate || !layout) {
        throw new HttpException(
          {
            message: 'Missing required parameters',
            code: 'AI-400',
          },
          400,
        );
      }

      const mergedStoryPanels = existingPages.flatMap(
        (scene) => scene.storyPanels,
      );
      const preset: Preset = getPreset(presetName);
      const limitedStylePrompt = stylePrompt
        ? stylePrompt.trim().slice(0, 77).trim()
        : '';
      const lightPanelPromptPrefix: string = joinWords(
        preset.imagePrompt(limitedStylePrompt),
      );
      const degradedPanelPromptPrefix: string = joinWords([
        ...preset.imagePrompt(limitedStylePrompt),

        // we re-inject the story, then
        prompt,
      ]);
      const config = {
        vendor: 'SERVER' as LLMVendor,
        apiKey: '',
        modelId: '',
        // "vendor": "OPENAI" as LLMVendor,
        // "apiKey": process.env.AUTH_OPENAI_API_KEY as string,
        // "modelId": process.env.LLM_OPENAI_API_MODEL as string
      };
      console.log('Prompt ', prompt);
      let newStoryPanels: GeneratedPanel[] = await getStoryContinuation({
        preset,
        userStoryPrompt: prompt,
        stylePrompt: stylePrompt ? stylePrompt : '',
        nbPanelsToGenerate,
        maxNbPanels: 6,
        existingPanels: mergedStoryPanels as GeneratedPanel[],
        llmVendorConfig: config,
      });
      console.log('panels ', newStoryPanels);
      let startNewPanel =
        newStoryPanels.length !== nbPanelsToGenerate ? true : false;

      if (newStoryPanels.length === nbPanelsToGenerate) {
        startNewPanel = newStoryPanels.every((panel) =>
          Object.values(panel).every(
            (value) => value === '' && value === null && value === undefined,
          ),
        );
      }
      if (startNewPanel) {
        const newConfig = {
          vendor: 'OPENAI' as LLMVendor,
          apiKey: process.env.AUTH_OPENAI_API_KEY as string,
          modelId: process.env.LLM_OPENAI_API_MODEL as string,
        };

        newStoryPanels = await getStoryContinuation({
          preset,
          userStoryPrompt: prompt,
          stylePrompt: stylePrompt ? stylePrompt : '',
          nbPanelsToGenerate,
          maxNbPanels: 6,
          existingPanels: mergedStoryPanels as GeneratedPanel[],
          llmVendorConfig: newConfig,
        });
      }
      let getRenderedScenes: any = [];

      const newRenderedScenes = await Promise.all(
        newStoryPanels.map(async (panel, index) => {
          const { width, height } =
            layouts[layout][index % layouts[layout].length];
          const newPanel = joinWords([
            // what we do here is that ideally we give full control to the LLM for prompting,
            // unless there was a catastrophic failure, in that case we preserve the original prompt
            panel.instructions
              ? lightPanelPromptPrefix
              : degradedPanelPromptPrefix,

            panel.instructions || '',
          ]);
          const render: any = await newRender({
            prompt: newPanel,
            nbFrames: 1,
            width,
            height,
            withCache: false,
            settings: settings as Settings,
          });

          if (settings.renderingModelVendor !== 'REPLICATE') {
            let speechUrl: string | undefined = '';
            if (speechBubble) {
              const bubble = await addSpeechBubble(
                render.assetUrl,
                panel.speech,
                bubbleShape,
                fontSize,
              );
              if (bubble && bubble.url) {
                speechUrl = bubble.url;
              }
            }
            render['speechUrl'] = speechUrl;
          }

          render['width'] = width;
          render['height'] = height;
          render['speech'] = panel.speech;
          render['id'] = Math.random().toString(36).substr(2, 10);
          return render;
        }),
      );

      getRenderedScenes = newRenderedScenes;
      console.log('Results: ' + newRenderedScenes);

      if (settings.renderingModelVendor === 'REPLICATE') {
        getRenderedScenes = await Promise.all(
          newRenderedScenes.map(async (scene, index) => {
            const newRendered: any = await getRender(
              scene?.renderId as string,
              settings,
            );
            let speechUrl: string | undefined = '';
            if (speechBubble) {
              const bubble = await addSpeechBubble(
                scene.assetUrl,
                scene.speech,
                bubbleShape,
                fontSize,
              );
              if (bubble && bubble.url) {
                speechUrl = bubble.url;
              }
            }
            // const id = uuidv4()
            newRendered['id'] = Math.random().toString(36).substr(2, 10);
            newRendered['width'] = scene.width;
            newRendered['height'] = scene.height;
            newRendered['speechUrl'] = speechUrl;
            return newRendered;
          }),
        );
      }

      const updatedPages = [
        { storyPanels: newStoryPanels, renderedScenes: getRenderedScenes },
      ];
      return {
        message: 'Comics Generated Successfully.',
        pages: updatedPages,
        code: 'AI-200',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.response?.message || 'Error generating Comics.',
          code: error.response?.code || 'AI-500',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('/redrawPanel')
  @ApiBody({
    schema: {
      example: {
        prompt: '',
        stylePrompt: '',
      },
    },
  })
  async redrawPanel(@Body() body: any) {
    try {
      const {
        id,
        newPrompt,
        width,
        height,
        presetName,
        stylePrompt,
        speechBubble,
        fontSize,
        bubbleShape,
      }: {
        id: string;
        newPrompt: string;
        width: number;
        height: number;
        stylePrompt: string;
        presetName: string;
        nbPanelsToGenerate: number;
        speechBubble: boolean;
        fontSize: number;
        bubbleShape: string;
      } = body;

      if (!id || !newPrompt || !width || !height) {
        throw new HttpException(
          {
            message: 'Missing required parameters',
            code: 'AI-400',
          },
          400,
        );
      }

      const preset: Preset = getPreset(presetName);

      const limitedStylePrompt = stylePrompt
        ? stylePrompt.trim().slice(0, 77).trim()
        : '';
      const lightPanelPromptPrefix: string = joinWords(
        preset.imagePrompt(limitedStylePrompt),
      );
      const degradedPanelPromptPrefix: string = joinWords([
        ...preset.imagePrompt(limitedStylePrompt),

        // we re-inject the story, then
        newPrompt,
      ]);
      const config = {
        vendor: 'SERVER' as LLMVendor,
        apiKey: '',
        modelId: '',
        // "vendor": "OPENAI" as LLMVendor,
        // "apiKey": process.env.AUTH_OPENAI_API_KEY as string,
        // "modelId": process.env.LLM_OPENAI_API_MODEL as string
      };
      let panels: GeneratedPanel[] = await getStoryContinuation({
        preset,
        userStoryPrompt: newPrompt,
        stylePrompt: stylePrompt ? stylePrompt : '',
        nbPanelsToGenerate: 1,
        maxNbPanels: 1,
        existingPanels: [],
        llmVendorConfig: config,
      });

      if (panels[0].instructions === '') {
        const newConfig = {
          vendor: 'OPENAI' as LLMVendor,
          apiKey: process.env.AUTH_OPENAI_API_KEY as string,
          modelId: process.env.LLM_OPENAI_API_MODEL as string,
        };

        panels = await getStoryContinuation({
          preset,
          userStoryPrompt: newPrompt,
          stylePrompt: stylePrompt ? stylePrompt : '',
          nbPanelsToGenerate: 1,
          maxNbPanels: 1,
          existingPanels: [],
          llmVendorConfig: newConfig,
        });
      }

      const newPanel = joinWords([
        // what we do here is that ideally we give full control to the LLM for prompting,
        // unless there was a catastrophic failure, in that case we preserve the original prompt
        panels[0].instructions
          ? lightPanelPromptPrefix
          : degradedPanelPromptPrefix,

        panels[0].instructions || '',
      ]);

      const render: any = await newRender({
        prompt: newPanel,
        nbFrames: 1,
        width,
        height,
        withCache: false,
        settings: settings as Settings,
      });

      let speechUrl: string | undefined = '';
      if (speechBubble) {
        const bubble = await addSpeechBubble(
          render.assetUrl,
          panels[0].speech,
          bubbleShape,
          fontSize,
        );
        if (bubble && bubble.url) {
          speechUrl = bubble.url;
        }
      }
      render['speechUrl'] = speechUrl;

      render['width'] = width;
      render['height'] = height;
      render['speech'] = panels[0].speech;
      render['id'] = id;
      return {
        message: 'Comics Redraw Successfully.',
        id,
        newRenderedScene: render,
        storyPanel: panels[0],
        code: 'AI-200',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.response?.message || 'Error generating Comics.',
          code: error.response?.code || 'AI-500',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
