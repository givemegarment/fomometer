import { describe, expect, it } from 'vitest';
import { oauthSignature, pct } from './x';

describe('X OAuth 1.0a', () => {
  it('reproduces the signature from X\'s "Creating a signature" guide', async () => {
    // Every value below is the published example from the X developer docs.
    const { signature } = await oauthSignature(
      'POST',
      'https://api.twitter.com/1.1/statuses/update.json',
      { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
      {
        apiKey: 'xvz1evFS4wEEPTGEFPHBog',
        apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
        accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
        accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE'
      },
      'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
      '1318622958'
    );
    expect(signature).toBe('hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
  });

  it('percent-encodes the RFC 3986 reserved characters', () => {
    expect(pct("Ladies + Gentlemen!*'()")).toBe('Ladies%20%2B%20Gentlemen%21%2A%27%28%29');
  });
});
