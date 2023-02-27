# MetroDreamin'

MetroDreamin' is a web application that allows you to design and visualize the transportation system that you wish your city had, and check out the transit dreams of other users from around the world.

## Contact

If you have any feature suggestions, questions, or anything, please DM me on twitter [@metrodreamin](https://twitter.com/MetroDreamin)!

## Project Structure

### Core application code: `app/`
`app/` contains all the code for the Next.js/React front end and server side rendering. Run `yarn dev` to start up a local Next server that connects to the staging Firebase account. It can run connected to a local Firebase emulator by running `start_emulators.sh` and then starting Next with `yarn local`.

### Firebase functions code: `functions/`
`functions/` contains a simple express-based REST server that handles requests to modify tables mostly associated with version 2.0. Use `yarn serve` to run locally and `yarn deploy` to deploy only Firebase functions. It also includes database callback functions associated with version 3.0 to do things like generate thumbnails, send notifications, etc.

### City map scripts: `city_scripts/`
`city_scripts/` contains all of the scripts used to generate the default map options.

### Maintenance: `maintenance_scripts/`
`maintenance_scripts/` contains scripts used for certain database operations. The `migration/` subfolder contains the scripts used to migrate data for version 3.0.

## License

See the [LICENSE](LICENSE.txt) file for license rights and limitations (GNU AGPL).

This project is tested with BrowserStack.
