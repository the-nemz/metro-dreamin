import { writeBatch, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import { geohashForLocation } from 'geofire-common';

import { getPartsFromSystemId } from '/lib/util.js';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
const SPLIT_REGEX = /[\s,.\-_:;<>\/\\\[\]()=+|{}'"?!*#]+/;

export class Saver {
  constructor(firebaseContext, systemId, system = {}, meta = {}, makePrivate = false, ancestors = [], isNew = false) {
    this.firebaseContext = firebaseContext;
    this.systemId = systemId;
    this.system = system;
    this.meta = meta;
    this.makePrivate = makePrivate;
    this.ancestors = ancestors;
    this.isNew = isNew;

    const viewParts = getPartsFromSystemId(this.systemId);
    this.userId = viewParts.userId;
    this.systemNumStr = viewParts.systemNumStr;

    this.batchArray = [];
    this.operationCounter = 0;
    this.batchIndex = 0;
  }

  async save() {
    if (!this.checkIsSavable()) return;

    try {
      this.resetBatcher();
      this.batchArray.push(writeBatch(this.firebaseContext.database));

      await this.handleSystemDoc();
      await this.handleRemovedLines();
      await this.handleRemovedStations();
      await this.handleChangedLines();
      await this.handleChangedStations();

      this.batchArray.forEach(async batch => await batch.commit());
      console.log('System saved successfully!');
      return true;
    } catch (e) {
      console.error('Saver.save error: ', e);
    }
  }

  async updatePrivate() {
    if (!this.checkIsSavable()) return;

    try {
      const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
      const systemSnap = await getDoc(systemDoc);

      if (systemSnap.exists()) {
        await updateDoc(systemDoc, {
          isPrivate: this.makePrivate ? true : false
        });

        console.log('System visibility updated successfully!');
        return true;
      }
    } catch (e) {
      console.error('Saver.updateVisibility error: ', e);
    }
  }

  checkIsSavable() {
    if (!this.firebaseContext) return false;
    if (!this.systemId) return false;
    if (Object.keys(this.system).length === 0) return false;
    if (Object.keys(this.meta).length === 0) return false;

    if (!(this.firebaseContext.user && this.firebaseContext.user.uid && this.firebaseContext.user.uid === this.userId)) {
      // current user does not match one in systemId
      return;
    }

    return true;
  }

  resetBatcher() {
    this.batchArray = [];
    this.operationCounter = 0;
    this.batchIndex = 0;
  }

  async handleSystemDoc() {
    const systemDoc = doc(this.firebaseContext.database, `systems/${this.systemId}`);
    const systemSnap = await getDoc(systemDoc);

    const titleWords = this.generateTitleKeywords();
    const { centroid, maxDist } = this.getGeoData();
    const geoWords = await this.generateGeoKeywords(centroid, maxDist);
    const keywords = [...titleWords, ...geoWords];
    const uniqueKeywords = keywords.filter((kw, ind) => kw && ind === keywords.indexOf(kw));

    const numLines = Object.keys(this.system.lines || {}).length;

    let numStations = 0;
    let numWaypoints = 0;
    for (const station of Object.values(this.system.stations || {})) {
      if (station.isWaypoint) {
        numWaypoints++;
      } else {
        numStations++;
      }
    }

    const timestamp = Date.now();

    if (!this.isNew && systemSnap.exists()) {
      this.batchArray[this.batchIndex].update(systemDoc, {
        lastUpdated: timestamp,
        isPrivate: this.makePrivate ? true : false,
        title: this.system.title ? this.system.title : 'Map',
        caption: this.system.caption ? this.system.caption : '',
        meta: this.meta,
        keywords: uniqueKeywords,
        centroid: centroid || null,
        geohash: centroid ? geohashForLocation([ centroid.lat, centroid.lng ], 10) : null,
        maxDist: maxDist || null,
        numStations: numStations,
        numWaypoints: numWaypoints,
        numLines: numLines
      });

      this.operationCounter++;
    } else if (this.isNew && !systemSnap.exists()) {
      const userDoc = doc(this.firebaseContext.database, `users/${this.userId}`);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.systemsCreated || userData.systemsCreated === 0) {
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: userData.systemsCreated + 1
          });
        } else if (userData.systemIds) {
          // for backfilling
          const intIds = [...userData.systemIds, this.systemNumStr].map((a) => parseInt(a));
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: Math.max(...intIds) + 1
          });
        } else {
          this.batchArray[this.batchIndex].update(userDoc, {
            systemsCreated: (parseInt(this.systemNumStr) || 0) + 1
          });
        }

        this.batchArray[this.batchIndex].set(systemDoc, {
          systemId: this.systemId,
          userId: this.userId,
          systemNumStr: this.systemNumStr,
          creationDate: timestamp,
          lastUpdated: timestamp,
          isPrivate: this.makePrivate ? true : false,
          title: this.system.title ? this.system.title : 'Map',
          caption: this.system.caption ? this.system.caption : '',
          meta: this.meta,
          ancestors: this.ancestors,
          keywords: uniqueKeywords,
          centroid: centroid || null,
          geohash: centroid ? geohashForLocation([ centroid.lat, centroid.lng ], 10) : null,
          maxDist: maxDist || null,
          numStations: numStations,
          numWaypoints: numWaypoints,
          numLines: numLines
        });

        this.operationCounter += 2;
      } else {
        throw 'userSnap does not exist';
      }
    } else {
      throw 'isNew and systemSnap.exists() must not be the same';
    }
  }

  async handleRemovedLines() {
    const linesSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/lines`));
    linesSnap.forEach((lineDoc) => {
      if (!(lineDoc.id in this.system.lines)) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(lineDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleRemovedStations() {
    const stationsSnap = await getDocs(collection(this.firebaseContext.database, `systems/${this.systemId}/stations`));
    stationsSnap.forEach((stationDoc) => {
      if (!(stationDoc.id in this.system.stations)) {
        this.checkAndHandleBatching();

        this.batchArray[this.batchIndex].delete(stationDoc.ref);
        this.operationCounter++;
      }
    });
  }

  async handleChangedLines() {
    for (const lineKey in this.system.lines) {
      this.checkAndHandleBatching();

      const lineDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/lines/${lineKey}`);
      this.batchArray[this.batchIndex].set(lineDoc, this.system.lines[lineKey]);
      this.operationCounter++;
    }
  }

  async handleChangedStations() {
    for (const stationId in this.system.stations) {
      this.checkAndHandleBatching();

      const stationDoc = doc(this.firebaseContext.database, `systems/${this.systemId}/stations/${stationId}`);
      this.batchArray[this.batchIndex].set(stationDoc, this.system.stations[stationId]);
      this.operationCounter++;
    }
  }

  checkAndHandleBatching() {
    if (this.operationCounter >= 449) { // max of 500 but leaving a bit of space for reasons
      this.batchArray.push(writeBatch(this.firebaseContext.database));
      this.batchIndex++;
      this.operationCounter = 0;
    }
  }

  // functions below here were migrated from the v1 API

  generateTitleKeywords() {
    let keywords = [];
    if (this.system.title) {
      // Split the lowercase title on whitespace and special characters.
      // Add full title and each word of the title to the keywords.
      let title = this.system.title.toLowerCase();
      let titleWords = title.split(SPLIT_REGEX);
      keywords.push(...titleWords);
    }
    return keywords;
  }

  async generateGeoKeywords(coord, maxDist) {
    if (!coord) {
      return [];
    }

    let words = [];
    let placeType = 'place';
    if (maxDist > 3000) {
      return ['world', 'worldwide', 'global', 'earth', 'international'];
    } else if (maxDist > 1500) {
      placeType = 'country';
      words.push('international');
    } else if (maxDist > 500) {
      placeType = 'country';
    } else if (maxDist > 60) {
      placeType = 'region';
    }

    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord.lng},${coord.lat}.json?access_token=${mapboxgl.accessToken}`;
    let request = new XMLHttpRequest();
    request.open('GET', geocodeUrl, false);  // `false` makes the request synchronous
    request.send(null);

    if (request.status !== 200) {
      return words;
    }

    try {
      const result = JSON.parse(request.response);
      if (result && result.features) {
        const placeFeatures = result.features.filter((feature) => feature.place_type.includes(placeType));
        if (!placeFeatures.length) {
          return words;
        }

        const placeFeature = placeFeatures[0]; // should only be one
        let placeWords = (placeFeature.text || '').toLowerCase().split(SPLIT_REGEX);
        words.push(...placeWords);
        if (placeFeature.properties && placeFeature.properties.short_code) {
          let shortWords = placeFeature.properties.short_code.toLowerCase().split(SPLIT_REGEX);
          words.push(...shortWords);
        }

        for (const item of (placeFeature.context || [])) {
          let additionalWords = (item.text || '').toLowerCase().split(SPLIT_REGEX);
          let shortWords = (item.short_code || '').toLowerCase().split(SPLIT_REGEX);
          words.push(...additionalWords, ...shortWords);
        }
      }
    } catch (e) {
      console.log('generateGeoKeywords error:', e);
    }

    return words;
  }

  getDistance(coord1, coord2) {
    const unit = 'M';
    const lat1 = coord1.lat;
    const lon1 = coord1.lng;
    const lat2 = coord2.lat;
    const lon2 = coord2.lng;

    if ((lat1 === lat2) && (lon1 === lon2)) {
      return 0;
    } else {
      let radlat1 = Math.PI * lat1 / 180;
      let radlat2 = Math.PI * lat2 / 180;
      let theta = lon1 - lon2;
      let radtheta = Math.PI * theta / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

      if (dist > 1) {
        dist = 1;
      }

      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;

      if (unit === 'K') {
        dist = dist * 1.609344
      }
      return dist;
    }
  }

  getGeoData() {
    const numStations = Object.keys(this.system.stations).length;
    if (numStations) {
      // Get centroid and bounding box of all stations.
      // TODO: Consider getting average distance from each station to centroid instead of bbox max distance to centroid.
      let lats = [];
      let lngs = [];
      for (const sId in this.system.stations) {
        let currLat = typeof this.system.stations[sId].lat === 'string' ? parseFloat(this.system.stations[sId].lat) : this.system.stations[sId].lat;
        let currLng = typeof this.system.stations[sId].lng === 'string' ? parseFloat(this.system.stations[sId].lng) : this.system.stations[sId].lng;
        lats.push(currLat);
        lngs.push(currLng);
      }

      const sum = (total, curr) => total + curr;
      const corners = [
        {lat: Math.max(...lats), lng: Math.min(...lngs)},
        {lat: Math.max(...lats), lng: Math.max(...lngs)},
        {lat: Math.min(...lats), lng: Math.max(...lngs)},
        {lat: Math.min(...lats), lng: Math.min(...lngs)}
      ];
      const centroid = {
        lat: lats.reduce(sum) / numStations,
        lng: lngs.reduce(sum) / numStations
      };
      const maxDist = Math.max(...corners.map(c => this.getDistance(centroid, c)));

      return {
        centroid: centroid,
        maxDist: maxDist
      };
    }
    return {};
  }
}
