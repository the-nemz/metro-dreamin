import React from 'react';

export class Line extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className="Line">
        <div className="Line-title">
          <div className="Line-namePrev" style={{backgroundColor: this.props.line.color}}></div>
          <div className="Line-name">{this.props.line.name}</div>
        </div>
      </div>
    );
  }
}
