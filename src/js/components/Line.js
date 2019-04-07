import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showColorPicker: false,
      nameChanging: false
    };

    this.defaultLines = [
      {
        'name': 'Red Line',
        'color': '#e6194b'
      },
      {
        'name': 'Green Line',
        'color': '#3cb44b'
      },
      {
        'name': 'Yellow Line',
        'color': '#ffe119'
      },
      {
        'name': 'Blue Line',
        'color': '#4363d8'
      },
      {
        'name': 'Orange Line',
        'color': '#f58231'
      },
      {
        'name': 'Purple Line',
        'color': '#911eb4'
      },
      {
        'name': 'Cyan Line',
        'color': '#42d4f4'
      },
      {
        'name': 'Magenta Line',
        'color': '#f032e6'
      },
      {
        'name': 'Lime Line',
        'color': '#bfef45'
      },
      {
        'name': 'Pink Line',
        'color': '#fabebe'
      },
      {
        'name': 'Teal Line',
        'color': '#469990'
      },
      {
        'name': 'Lavender Line',
        'color': '#e6beff'
      },
      {
        'name': 'Brown Line',
        'color': '#9A6324'
      },
      {
        'name': 'Beige Line',
        'color': '#fffac8'
      },
      {
        'name': 'Maroon Line',
        'color': '#800000'
      },
      {
        'name': 'Mint Line',
        'color': '#aaffc3'
      },
      {
        'name': 'Olive Line',
        'color': '#808000'
      },
      {
        'name': 'Apricot Line',
        'color': '#ffd8b1'
      },
      {
        'name': 'Navy Line',
        'color': '#000075'
      },
      {
        'name': 'Grey Line',
        'color': '#a9a9a9'
      }
    ];
  }

  handleNameChange(value) {
    this.setState({
      name: value,
      nameChanging: true
    });
  }

  handleNameBlur(value) {
    let line = this.props.line;
    if (line.name !== value) {
      line.name = value;
      this.props.onLineInfoChange(line);
    }
    this.setState({
      name: '',
      nameChanging: false
    });
  }

  handleColorCancel() {
    this.setState({
      showColorPicker: false
    });
  }

  handleColorChange() {
    this.setState({
      showColorPicker: true
    });
  }

  handleColorSelect(chosen) {
    let line = this.props.line;
    const defNames = this.defaultLines.map(d => d.name);
    if (!defNames.includes(line.name)) {
      line.color = chosen.color;
    } else {
      line.color = chosen.color;
      line.name = chosen.name;
    }
    this.props.onLineInfoChange(line, true);
    this.setState({
      showColorPicker: false
    })
  }

  renderColorOptions() {
    let options = [];
    for (const defLine of this.defaultLines) {
      options.push(
        <button className="Line-color" key={defLine.color} title={defLine.name}
                style={{backgroundColor: defLine.color}}
                onClick={() => this.handleColorSelect(defLine)}>
        </button>
      );
    }
    return options;
  }

  renderStations() {
    const line = this.props.line;
    let stationElems = [];
    for (const stationId of line.stationIds) {
      stationElems.push(
        <li className="Line-station" key={stationId}>
          {this.props.system.stations[stationId].name}
        </li>
      );
    }
    if (!stationElems.length) {
      return <div className="Line-noStations">Not stations on this line yet!</div>;
    }
    return (
      <ul className="Line-stations">
        {stationElems}
      </ul>
    );
  }

  renderContent() {
    if (this.state.showColorPicker) {
      return (
        <div className="Line-colorsWrap">
          <div className="Line-colorsText">Choose a new color:</div>
          {this.renderColorOptions()}
          <button className="Line-colorsCancel Link" onClick={() => this.handleColorCancel()}>
            Cancel
          </button>
        </div>
      )
    } else {
      return (
        <div className="Line-stationsWrap">
          <div className="Line-staionsText">Stations:</div>
          {this.renderStations()}
        </div>
      );
    }
  }

  render() {
    const title = this.state.nameChanging ? this.state.name : this.props.line.name;
    return (
      <ReactCSSTransitionGroup
        transitionName="Focus"
        transitionAppear={true}
        transitionAppearTimeout={200}
        transitionEnter={false}
        transitionLeave={false}>
        <div className="Line Focus">
          <div className="Line-title">
            <button className="Line-namePrev" style={{backgroundColor: this.props.line.color}} onClick={() => this.handleColorChange()}></button>
            <input className="Line-name" type="text" value={title ? title : ''}
                   onChange={(e) => this.handleNameChange(e.target.value)}
                   onBlur={(e) => this.handleNameBlur(e.target.value)}>
            </input>
          </div>

          {this.renderContent()}
        </div>
      </ReactCSSTransitionGroup>
    );
  }
}
