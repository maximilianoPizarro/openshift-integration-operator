import * as React from 'react';

interface KaotoCanvasEmbedProps {
  flowName: string;
  kaotoUrl?: string;
}

/**
 * Embeds the Kaoto visual designer via iframe.
 * The Kaoto instance is deployed separately via kaoto-operator.
 * Communication with the parent frame uses postMessage API
 * for passing route/workflow definitions back and forth.
 */
const KaotoCanvasEmbed: React.FC<KaotoCanvasEmbedProps> = ({
  flowName,
  kaotoUrl = '/kaoto',
}) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'kaoto-design-update') {
        console.log('Received design update from Kaoto:', event.data.design);
        // TODO: PATCH the IntegrationFlow CR with the updated kaotoDesign
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [flowName]);

  const fullUrl = `${kaotoUrl}?flow=${encodeURIComponent(flowName)}`;

  return (
    <iframe
      ref={iframeRef}
      src={fullUrl}
      title={`Kaoto Designer - ${flowName}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

export default KaotoCanvasEmbed;
export { KaotoCanvasEmbed };
