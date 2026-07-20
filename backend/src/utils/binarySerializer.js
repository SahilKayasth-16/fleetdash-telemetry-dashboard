/**
 * Utility functions for binary serialization and deserialization of telemetry data.
 * Reduces bandwidth requirements when streaming data to dashboard clients.
 */

/**
 * Serializes a telemetry JSON object into a compact binary Buffer.
 *
 * Binary Layout:
 * - Offset 0: vehicleId length (1 byte, Uint8)
 * - Offset 1 to (1 + len): vehicleId string (utf-8)
 * - Offset (1 + len): latitude (8 bytes, Float64 / Double)
 * - Offset (9 + len): longitude (8 bytes, Float64 / Double)
 * - Offset (17 + len): speed (4 bytes, Float32)
 * - Offset (21 + len): heading (2 bytes, Uint16)
 * - Offset (23 + len): timestamp (8 bytes, Float64 - Epoch milliseconds)
 *
 * @param {Object} telemetry - Telemetry object.
 * @returns {Buffer} Compact binary Buffer.
 */
export function serializeTelemetry(telemetry) {
  try {
    const { vehicleId, latitude, longitude, speed, heading, timestamp } = telemetry;

    const vehicleIdBuffer = Buffer.from(vehicleId, 'utf8');
    const vehicleIdLength = vehicleIdBuffer.length;

    if (vehicleIdLength > 255) {
      throw new Error('vehicleId exceeds maximum length of 255 bytes');
    }

    // Calculate total buffer allocation size
    const totalLength = 1 + vehicleIdLength + 8 + 8 + 4 + 2 + 8;
    const buffer = Buffer.alloc(totalLength);

    let offset = 0;

    // Write vehicle ID length and characters
    buffer.writeUInt8(vehicleIdLength, offset);
    offset += 1;
    vehicleIdBuffer.copy(buffer, offset);
    offset += vehicleIdLength;

    // Write double-precision coordinates
    buffer.writeDoubleLE(latitude, offset);
    offset += 8;
    buffer.writeDoubleLE(longitude, offset);
    offset += 8;

    // Write single-precision speed and unsigned 16-bit heading
    buffer.writeFloatLE(speed, offset);
    offset += 4;
    buffer.writeUInt16LE(heading, offset);
    offset += 2;

    // Write timestamp as double-precision millisecond epoch
    const timeMs = new Date(timestamp).getTime();
    buffer.writeDoubleLE(timeMs, offset);

    return buffer;
  } catch (error) {
    throw new Error(`Serialization failed: ${error.message}`);
  }
}

/**
 * Deserializes a binary Buffer back into a telemetry JSON object.
 *
 * @param {Buffer} buffer - Telemetry binary Buffer.
 * @returns {Object} Re-constructed telemetry JSON object.
 */
export function deserializeTelemetry(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Input must be a Node.js Buffer');
    }

    let offset = 0;

    // Read vehicle ID length and characters
    const vehicleIdLength = buffer.readUInt8(offset);
    offset += 1;
    const vehicleId = buffer.toString('utf8', offset, offset + vehicleIdLength);
    offset += vehicleIdLength;

    // Read double-precision coordinates
    const latitude = buffer.readDoubleLE(offset);
    offset += 8;
    const longitude = buffer.readDoubleLE(offset);
    offset += 8;

    // Read speed and heading
    const speed = Number(buffer.readFloatLE(offset).toFixed(2));
    offset += 4;
    const heading = buffer.readUInt16LE(offset);
    offset += 2;

    // Read timestamp
    const timeMs = buffer.readDoubleLE(offset);
    const timestamp = new Date(timeMs);

    return {
      vehicleId,
      latitude,
      longitude,
      speed,
      heading,
      timestamp,
    };
  } catch (error) {
    throw new Error(`Deserialization failed: ${error.message}`);
  }
}
export default { serializeTelemetry, deserializeTelemetry };
