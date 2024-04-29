const stdout = [];
const stderr = [];

const addData = (data, dest) => {
  if (typeof data === "object") {
    dest.push(
      ...Object.entries(data).map(([key, value]) => `${key}: ${value}`)
    );
  } else if (Array.isArray(data)) {
    dest.push(...data);
  } else {
    dest.push(data);
  }
};

export const clean = () => {
  stdout.length = 0;
};

export const write = (data) => {
  addData(data, stdout);
};

export const error = (data) => {
  addData(data, stderr);
};
