import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getConfig } from '../lib/api.js';

/* Stripe card capture.

   The browser gets exactly one Stripe value: the publishable key (pk_...),
   which Stripe publishes by design. It arrives from /api/config/:locationId
   rather than being baked into the bundle, because there is one Stripe account
   per location and the right key is not known until a kitchen is chosen.

   Card numbers never touch this origin. PaymentElement renders in a Stripe
   iframe and tokenises against Stripe directly — this app's servers never see
   a PAN, which is what keeps the deployment in PCI SAQ-A rather than SAQ-D.

   The intent is created server-side with capture_method: 'manual'. That is the
   whole payment model: authorize now, capture when the food goes out. */

let cache = {};

function stripeFor(publishableKey) {
  if (!publishableKey) return null;
  if (!cache[publishableKey]) cache[publishableKey] = loadStripe(publishableKey);
  return cache[publishableKey];
}

export default function StripePayment({ locationId, clientSecret, onReady, onError }) {
  const [config, setConfig] = useState(null);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    let live = true;
    getConfig(locationId)
      .then((c) => live && setConfig(c))
      .catch((e) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, [locationId]);

  const promise = useMemo(() => stripeFor(config?.stripePublishableKey), [config]);

  if (failed) {
    return (
      <p className="note note--stop">
        <span>
          <strong>Card entry is unavailable.</strong> {failed} No card details were
          collected and nothing was charged.
        </span>
      </p>
    );
  }

  if (!config) {
    return (
      <p className="note" role="status">
        <span>Loading secure card entry…</span>
      </p>
    );
  }

  if (!config.stripePublishableKey) {
    return (
      <div className="note note--ask">
        <span>
          <strong>Stripe is not configured for {config.locationName}.</strong> Set{' '}
          <code>STRIPE_SECRET_KEY_{config.envSuffix}</code> and{' '}
          <code>STRIPE_PUBLISHABLE_KEY_{config.envSuffix}</code> in the server
          environment. Until then the order can be placed for the kitchen to see, but no
          card is held.
        </span>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <p className="note" role="status">
        <span>Preparing the authorization…</span>
      </p>
    );
  }

  return (
    <Elements
      stripe={promise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: getToken('--tomato'),
            colorBackground: getToken('--surface'),
            colorText: getToken('--ink'),
            colorTextSecondary: getToken('--ink-2'),
            colorDanger: getToken('--tomato-ink'),
            fontFamily: getToken('--text'),
            borderRadius: getToken('--r-sm'),
            spacingUnit: '4px',
          },
        },
      }}
    >
      <CardFields onReady={onReady} onError={onError} />
    </Elements>
  );
}

/* Stripe's iframe cannot read our CSS variables, so the appearance API is fed
   the resolved token values. The design system stays the single source. */
function getToken(name) {
  if (typeof window === 'undefined') return undefined;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

function CardFields({ onReady, onError }) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;
    onReady?.(async () => {
      const { error } = await elements.submit();
      if (error) {
        onError?.(error.message);
        return null;
      }
      return { stripe, elements };
    });
  }, [stripe, elements, onReady, onError]);

  return <PaymentElement options={{ layout: 'tabs' }} />;
}
