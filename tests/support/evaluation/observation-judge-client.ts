import {
  getOutputText,
  getResponsesUrl,
  type FetchImplementation,
  type LlmGatewayJudgeConfig,
  type ObservationJudge,
} from './judge-client.js';
import {
  buildExploratoryObservationInstructions,
  buildExploratoryObservationResponseFormat,
  parseExploratoryObservationReport,
} from './rubrics/exploratory-observation.rubric.js';

export function createLlmGatewayObservationJudge(
  config: LlmGatewayJudgeConfig,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): ObservationJudge {
  return {
    async evaluate(evidence) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchImplementation(
          getResponsesUrl(config.gatewayUrl),
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + config.token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model,
              input: [
                {
                  role: 'developer',
                  content: [
                    {
                      type: 'input_text',
                      text: buildExploratoryObservationInstructions(),
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: JSON.stringify({
                        deterministicStatus: evidence.route.status,
                        route: evidence.route.steps,
                        screenshots: evidence.route.screenshots.map(
                          (screenshot, imageIndex) => ({
                            imageIndex,
                            label: screenshot.label,
                            stepIndex: screenshot.stepIndex,
                            action: screenshot.action,
                            target: screenshot.target,
                          }),
                        ),
                        routeVerdict: evidence.routeResult,
                        stepJudgments: evidence.stepResults.map(
                          ({ step, result, screenshot }) => ({
                            step,
                            result,
                            screenshot: screenshot
                              ? {
                                  label: screenshot.label,
                                  action: screenshot.action,
                                  target: screenshot.target,
                                  routeScreenshotIndex:
                                    evidence.route.screenshots.findIndex(
                                      (routeScreenshot) =>
                                        routeScreenshot.label ===
                                        screenshot.label,
                                    ),
                                }
                              : undefined,
                          }),
                        ),
                      }),
                    },
                    ...evidence.route.screenshots.map((screenshot) => ({
                      type: 'input_image',
                      image_url:
                        'data:image/png;base64,' +
                        screenshot.image.toString('base64'),
                      detail: 'low',
                    })),
                  ],
                },
              ],
              text: { format: buildExploratoryObservationResponseFormat() },
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return {};
        }

        const payload = await response.json();
        const outputText = getOutputText(payload);
        const report = outputText
          ? parseExploratoryObservationReport(
              outputText,
              evidence.route.steps.length,
              evidence.route.screenshots.length,
            )
          : undefined;

        return config.attachRawResponse
          ? { report, rawResponse: payload }
          : { report };
      } catch {
        return {};
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
