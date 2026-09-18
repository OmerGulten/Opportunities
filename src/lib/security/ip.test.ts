import { describe, expect, it } from "vitest";

import { formatIpv6, isIpLiteral, isPrivateOrReservedIp, normalizeHostname, parseIp, parseIpv4, parseIpv6 } from "./ip";

describe("parseIpv4", () => {
  it("accepts canonical dotted quads", () => {
    expect(parseIpv4("0.0.0.0")).toEqual([0, 0, 0, 0]);
    expect(parseIpv4("93.184.216.34")).toEqual([93, 184, 216, 34]);
    expect(parseIpv4("255.255.255.255")).toEqual([255, 255, 255, 255]);
  });

  it("rejects non-canonical and malformed forms", () => {
    expect(parseIpv4("010.0.0.1")).toBeNull(); // octal-looking
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(parseIpv4("1.2.3.4.5")).toBeNull();
    expect(parseIpv4("256.0.0.1")).toBeNull();
    expect(parseIpv4("0x7f.0.0.1")).toBeNull();
    expect(parseIpv4("1.2.3.-4")).toBeNull();
    expect(parseIpv4("")).toBeNull();
  });
});

describe("parseIpv6", () => {
  it("expands compression, brackets, zone ids and embedded IPv4", () => {
    expect(parseIpv6("::1")?.slice(14)).toEqual([0, 1]);
    expect(parseIpv6("[::1]")).toEqual(parseIpv6("::1"));
    expect(parseIpv6("fe80::1%eth0")).toEqual(parseIpv6("fe80::1"));
    expect(parseIpv6("::ffff:127.0.0.1")?.slice(10)).toEqual([255, 255, 127, 0, 0, 1]);
    expect(parseIpv6("2001:db8::")?.slice(0, 4)).toEqual([0x20, 0x01, 0x0d, 0xb8]);
    expect(parseIpv6("1:2:3:4:5:6:7:8")?.slice(0, 4)).toEqual([0, 1, 0, 2]);
    expect(parseIpv6("1:2:3:4:5:6:7::")).not.toBeNull();
  });

  it("rejects malformed addresses", () => {
    expect(parseIpv6("1::2::3")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(parseIpv6(":1:2:3:4:5:6:7")).toBeNull();
    expect(parseIpv6("12345::")).toBeNull();
    expect(parseIpv6("::ffff:999.0.0.1")).toBeNull();
    expect(parseIpv6("127.0.0.1")).toBeNull();
  });
});

describe("formatIpv6 / parseIp", () => {
  it("round-trips a canonical compressed form", () => {
    const parsed = parseIp("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(parsed?.version).toBe(6);
    expect(parsed?.canonical).toBe("2001:db8::1");
    expect(formatIpv6(parseIpv6("::") as number[])).toBe("::");
    expect(formatIpv6(parseIpv6("1:2:3:4:5:6:7:8") as number[])).toBe("1:2:3:4:5:6:7:8");
  });

  it("classifies version and canonical text", () => {
    expect(parseIp("93.184.216.34")).toEqual({ version: 4, bytes: [93, 184, 216, 34], canonical: "93.184.216.34" });
    expect(parseIp("[fe80::1%eth0]")?.canonical).toBe("fe80::1");
    expect(parseIp("example.com")).toBeNull();
  });
});

describe("normalizeHostname", () => {
  it("strips brackets, zone ids, trailing dots and case", () => {
    expect(normalizeHostname("EXAMPLE.com.")).toBe("example.com");
    expect(normalizeHostname("[::1]")).toBe("::1");
    expect(normalizeHostname("[fe80::1%eth0]")).toBe("fe80::1");
    expect(normalizeHostname("  Example.COM  ")).toBe("example.com");
  });
});

describe("isIpLiteral", () => {
  it("recognises canonical literals", () => {
    expect(isIpLiteral("127.0.0.1")).toBe(true);
    expect(isIpLiteral("[::1]")).toBe(true);
    expect(isIpLiteral("fe80::1%eth0")).toBe(true);
  });

  it("recognises ambiguous numeric forms so callers can fail closed", () => {
    expect(isIpLiteral("2130706433")).toBe(true);
    expect(isIpLiteral("0x7f.0.0.1")).toBe(true);
    expect(isIpLiteral("0177.0.0.1")).toBe(true);
  });

  it("treats real hostnames as names", () => {
    expect(isIpLiteral("example.com")).toBe(false);
    expect(isIpLiteral("1e100.net")).toBe(false);
    expect(isIpLiteral("")).toBe(false);
  });
});

describe("isPrivateOrReservedIp — IPv4 ranges", () => {
  const blocked = [
    ["0.0.0.0/8", "0.0.0.0", "0.255.255.255"],
    ["10/8", "10.0.0.0", "10.255.255.255"],
    ["100.64/10", "100.64.0.0", "100.127.255.255"],
    ["127/8", "127.0.0.1", "127.255.255.255"],
    ["169.254/16", "169.254.0.1", "169.254.169.254"],
    ["172.16/12", "172.16.0.1", "172.31.255.255"],
    ["192.0.0/24", "192.0.0.0", "192.0.0.255"],
    ["192.0.2/24", "192.0.2.1", "192.0.2.255"],
    ["192.88.99/24", "192.88.99.1", "192.88.99.255"],
    ["192.168/16", "192.168.0.1", "192.168.255.255"],
    ["198.18/15", "198.18.0.1", "198.19.255.255"],
    ["198.51.100/24", "198.51.100.1", "198.51.100.255"],
    ["203.0.113/24", "203.0.113.1", "203.0.113.255"],
    ["224/4", "224.0.0.1", "239.255.255.255"],
    ["240/4", "240.0.0.1", "255.255.255.254"],
  ] as const;

  for (const [label, low, high] of blocked) {
    it(`blocks ${label}`, () => {
      expect(isPrivateOrReservedIp(low)).toBe(true);
      expect(isPrivateOrReservedIp(high)).toBe(true);
    });
  }

  it("blocks the broadcast address", () => {
    expect(isPrivateOrReservedIp("255.255.255.255")).toBe(true);
  });

  it("allows public addresses, including ones adjacent to reserved ranges", () => {
    for (const ip of ["93.184.216.34", "9.255.255.255", "11.0.0.0", "100.63.255.255", "100.128.0.0", "172.15.255.255", "172.32.0.0", "192.167.255.255", "192.169.0.0", "198.17.255.255", "198.20.0.0", "223.255.255.255", "8.8.8.8"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(false);
    }
  });
});

describe("isPrivateOrReservedIp — IPv6 ranges", () => {
  it("blocks the unspecified and loopback addresses", () => {
    expect(isPrivateOrReservedIp("::")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("[::1]")).toBe(true);
  });

  it("blocks unique-local, link-local and multicast", () => {
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456::1")).toBe(true);
    expect(isPrivateOrReservedIp("fdff:ffff::")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1%eth0")).toBe(true);
    expect(isPrivateOrReservedIp("febf::1")).toBe(true);
    expect(isPrivateOrReservedIp("ff02::1")).toBe(true);
  });

  it("blocks the documentation range", () => {
    expect(isPrivateOrReservedIp("2001:db8::1")).toBe(true);
    expect(isPrivateOrReservedIp("2001:0db8:0000::abcd")).toBe(true);
  });

  it("looks inside IPv4-mapped addresses", () => {
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:7f00:1")).toBe(true); // hex spelling of 127.0.0.1
    expect(isPrivateOrReservedIp("::ffff:93.184.216.34")).toBe(false);
  });

  it("blocks the whole deprecated IPv4-compatible block ::/96", () => {
    expect(isPrivateOrReservedIp("::127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::93.184.216.34")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff")).toBe(true);
  });

  it("looks inside the NAT64 well-known prefix", () => {
    expect(isPrivateOrReservedIp("64:ff9b::127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("64:ff9b::169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("64:ff9b::93.184.216.34")).toBe(false);
  });

  it("allows public IPv6", () => {
    expect(isPrivateOrReservedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
    expect(isPrivateOrReservedIp("2001:4860:4860::8888")).toBe(false);
  });

  it("returns false for values that are not IP literals", () => {
    expect(isPrivateOrReservedIp("example.com")).toBe(false);
    expect(isPrivateOrReservedIp("0177.0.0.1")).toBe(false);
    expect(isPrivateOrReservedIp("")).toBe(false);
  });
});
