# MetroDreamin'

MetroDreamin' is a web application that allows you to design and visualize the transportation system that you wish your city had, and check out the transit dreams of other users from around the world.

## Contact

If you have any feature suggestions, questions, or anything, please DM us on twitter [@metrodreamin](https://twitter.com/MetroDreamin?s=20)!

## Project Structure

### Web front end code: `app/`
`app/` contains all the code for the React web front end. It was created with create-react-app and can be used as such, like running locally with `yarn start`.

### Firebase functions code: `functions/`
`functions/` contains a simple express-based REST server that handles requests to modify tables mostly associated with version 2.0. Use `yarn serve` to run locally and `yarn deploy` to deploy only Firebase functions.

### City map scripts: `city_scripts/`
`city_scripts/` contains all of the scripts used to generate the default map options.

### Maintenance: `maintenance_scripts/`
`maintenance_scripts/` contains scripts used for certain database operations.
