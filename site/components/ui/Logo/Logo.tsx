const Logo = ({ className = '', ...props }) => (
  <svg
    width="256"
    height="256"
    viewBox="0 0 256 256"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-10 h-10 ${className}`}
    {...props}
  >
    <path
      d="M116.438 243.262L117.438 104.262H30.4383C8.0131 104.26 0.87502 127.322 16.0174 142.466L116.438 243.262Z"
      fill="#404040"
    />
    <path
      d="M117.438 104.262H86.4385L116.438 243.262V243.257L117.438 104.262Z"
      fill="#262626"
    />
    <path
      d="M248.623 111.447L116.438 243.262L116.576 36.6171C116.554 17.003 142.316 5.14747 156.201 19.0317L248.623 111.447Z"
      fill="#171717"
    />
  </svg>
)

export default Logo
