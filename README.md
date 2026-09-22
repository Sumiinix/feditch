# [Pre-alpha] Feditch

<a href="https://git.sumiinix.moe/Sumiinix/feditch">![Static Badge](https://img.shields.io/badge/Forgejo-24283b?style=for-the-badge&color=e0af68
)</a>  
<a href="https://dl.sumiinix.moe/download/feditch/latest.signed.xpi">![Static Badge](https://img.shields.io/badge/Get_on_Firefox-24283b?style=for-the-badge&labelColor=24283b&color=9d7cd8)
</a>

Maybe yet another Fediverse instance switcher

> [!NOTE]
> This is currently in **pre-alpha**. It may contain breaking changes.

Feditch allows you to switch between (ActivityPub-based) Fediverse instances. Add the server where your account exists in the settings. To redirect, open the extension on the ActivityPub compatible post page and click the destination you want to redirect to.

## Redirect method

### Endpoint

If an endpoint that can be used for redirection is exposed on the instance, Feditch can detect the redirection method.

This typically works with [Mastodon](https://joinmastodon.org/), Mastodon-compatible instances, [Misskey](https://misskey-hub.net/en/), [PeerTube](https://joinpeertube.org/), etc. However, it doesn't work with all Mastodon-compatible servers, and PeerTube redirects work between PeerTube instances.

Endpoints are discovered using Webfinger. Recent versions of Mastodon can find endpoints using only domain information, but older versions of Mastodon, compatible servers, and other software require some kind of username to find endpoints. Therefore, when adding a new redirect in Feditch, you will be prompted to enter a username.

These endpoints are URL templates. So, if your home instance's endpoint is `https://home.example.com/authorize_interaction?uri={uri}` and the URL of a post on the remote instance is `https://remote.example.com/post/id`, the redirect URL would be:

```text
https://home.example.com/authorize_interaction?uri=https%3A%2F%2Fremote.example.com%2Fpost%2Fid
```

<!-- ### URL Template

> We plan to add a redirect method using URL templates. This should be flexible and allow for the addition of software-specific redirects, such as `https://example.com/search?query={uri}`. -->

## Find ActivityPub

To redirect from a remote server, you need to be currently on an ActivityPub-compatible page. Basically, it's a page for a specific post or an account profile page, not a timeline or trends page.

When you open the Feditch extension popup, it will fetch the current URL to check if it's ActivityPub-compatible. Then, it will show in the popup whether redirection is possible. However, it cannot detect all ActivityPub-compatible pages. If detection fails, it will display "Not Found," but if you know it's redirectable, just go ahead and redirect.

## Install

Signed builds of Firefox are currently available. Chrome builds are planned.

- [Install on Firefox](https://dl.sumiinix.moe/download/feditch/latest.signed.xpi)

## License

MIT License. See the [LICENSE](./LICENSE) file for details.
