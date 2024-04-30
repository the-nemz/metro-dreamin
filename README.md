# MetroDreamin'

MetroDreamin' is a web application that allows users to design and visualize their dream transportation systems, and peruse the transit fantasies of other users from around the world.

This repository contains all the code for the web frontend and Server Side Rendering (SSR) for the webapp.

## Contact

If you have any feature suggestions, questions, or anything, please [email me](mailto:isaac@metrodreamin.com)!

If you love MetroDreamin', consider donating to the [Ko-fi](https://ko-fi.com/metrodreamin).

## Implementation

MetroDreamin' is a [Next.js](https://nextjs.org/) project, which is an isomorphic/"Universal" javascript framework built on top of React. The isomorphic nature of Next.js is why this repository include portions of the backend of the project, namely the SSR. *Note: MetroDreamin' uses the Next.js "pages" directory, not the "app" directory.*

Much of the backend of the project, including the NoSQL database, authentification, and blob storage, is powered by [Firebase](https://firebase.google.com/).

The maps themselves are powered by [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/guides/).

## Project Structure

### App routes: `pages/`
`pages/` contains all the code for the Next.js routes for all the – you guessed it – pages for MetroDreamin's front end. Most of the pages utilize SSR in their implementation.

### React components: `components/`
`components/` contains the React componts used on the above pages.

### Utilities: `util/`
`util/` contains the reusable snippets used throughout the app including contexts, hooks, helper functions, etc.

### Styling: `styles/`
`styles/` includes the SCSS that makes MetroDreamin' look pretty.

### Assets: `public/`
`public/` includes static assets used on the site.

## Getting Started

After installing the dependencies, you can run the development server by running:

```bash
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Reference

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Firebase Modular Documentation](https://firebase.google.com/docs/reference/js) - learn about Firebase (modular) features and API
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/guides/) - learn about Mapbox GL JS features and API

## License

See the [LICENSE](LICENSE.txt) file for license rights and limitations (GNU AGPL).

This project is tested with [BrowserStack](https://www.browserstack.com/).
